import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ParticipantService } from '../../services/participant.service';
import { QuestionDetail, SubmitAnswerRequest } from '../../models/participant.models';

type Question = { id: string; text: string; options: string[]; answer: string; timerSeconds: number; };

@Component({
  selector: 'app-quiz-page',
  standalone: true,
  imports: [
    NgIf, NgFor, MatSnackBarModule
  ],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizPageComponent implements OnInit, OnDestroy {
  questions: Question[] = [];
  questionDetails: QuestionDetail[] = [];
  
  currentIndex = 0;
  score = 0;
  selected: string | null = null;
  finished = false;
  loading = true; 
  submitting = false; // Separate flag for answer submission
  waitingForNext = false;
  participantId: number = 0;
  sessionId: number = 0;
  quizTitle: string = '';
  sessionCode: string = '';
  participantName: string = '';

  // Timer properties
  timeRemaining: number = 30;
  timerInterval: any = null;
  
  // Server time sync
  serverTimeOffsetMs: number = 0;
  startedAtMs: number = 0;
  currentQuestionStartMs: number = 0;
  lastBackWarnAt: number = 0;

  private snackBar = inject(MatSnackBar);
  private participantService = inject(ParticipantService);
  router = inject(Router);

  async ngOnInit() {
    // Get participant and session data from localStorage
    const participantIdStr = localStorage.getItem('participantId');
    const sessionIdStr = localStorage.getItem('sessionId');
    const quizTitleStr = localStorage.getItem('quizTitle');
    const sessionCodeStr = localStorage.getItem('sessionCode');
    const participantNameStr = localStorage.getItem('participantName') || localStorage.getItem('userName');

    if (!participantIdStr || !sessionIdStr) {
      this.snackBar.open('No session found. Please join a quiz first.', 'Close', { duration: 3000 });
      this.router.navigate(['/participant']);
      return;
    }

    this.participantId = parseInt(participantIdStr);
    this.sessionId = parseInt(sessionIdStr);
    this.quizTitle = quizTitleStr || 'Quiz';
    this.sessionCode = sessionCodeStr || '';
    this.participantName = participantNameStr || '';

    this.blockBackNavigation();

    await this.loadQuestions();
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.blockBackNavigation();
    void this.refreshSessionSync();

    const now = Date.now();
    if (now - this.lastBackWarnAt > 2000) {
      this.lastBackWarnAt = now;
      this.snackBar.open('Back navigation is disabled during the quiz.', 'Close', { duration: 2000 });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    event.preventDefault();
    event.returnValue = '';
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.refreshSessionSync();
    }
  }

  @HostListener('window:pageshow', ['$event'])
  onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      void this.refreshSessionSync();
    }
  }

  private async refreshSessionSync(): Promise<void> {
    try {
      if (!this.sessionId) return;
      const response = await this.participantService.getSessionQuestions(this.sessionId);

      if (this.questions.length === 0 && response.questions?.length) {
        this.questionDetails = response.questions;
        this.questions = response.questions.map((q, index) => ({
          id: (index + 1).toString(),
          text: q.questionText,
          options: q.options.map(o => o.optionText),
          answer: '',
          timerSeconds: q.timerSeconds || 30
        }));
      }

      const serverTimeMs = Date.now();
      this.serverTimeOffsetMs = serverTimeMs - Date.now();
      this.startedAtMs = serverTimeMs;
      this.updateQuestionState();
    } catch (error) {
      console.error('[QuizPage] Failed to refresh session sync:', error);
    }
  }

  private blockBackNavigation(): void {
    const currentUrl = window.location.href;
    window.history.pushState(null, '', currentUrl);
    window.history.pushState(null, '', currentUrl);
  }

  async loadQuestions() {
    try {
      this.loading = true;
      const response = await this.participantService.getSessionQuestions(this.sessionId);
      
      this.questionDetails = response.questions;
      this.quizTitle = response.quizTitle;

      // Convert to the format expected by the existing components
      this.questions = response.questions.map((q, index) => ({
        id: (index + 1).toString(),
        text: q.questionText,
        options: q.options.map(o => o.optionText),
        answer: '', // We don't show the answer to participants
        timerSeconds: q.timerSeconds || 30
      }));

      this.loading = false;
      this.currentQuestionStartMs = this.getServerNowMs();

      // Start timer for first question
      this.startTimer();

      console.log(`[QuizPage] Loaded ${this.questions.length} questions for session ${this.sessionId}`);
    } catch (error: any) {
      console.error('[QuizPage] Failed to load questions:', error);
      this.snackBar.open('Failed to load quiz questions. Please try again.', 'Close', { duration: 3000 });
      this.loading = false;
      this.router.navigate(['/participant']);
    }
  }

  get currentQuestion(): Question | null {
    return this.questions[this.currentIndex] ?? null;
  }

  onSelectedChange(value: string) {
    console.log('[QuizPage] onSelectedChange:', value);
    this.selected = value; // enables submit button
  }

  startTimer() {
    // Clear any existing timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Set initial time from current question
    const currentQ = this.questions[this.currentIndex];
    this.timeRemaining = currentQ?.timerSeconds || 30;

    // Start countdown
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining <= 0) {
        // Auto-submit when timer expires
        this.autoSubmitAnswer();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async autoSubmitAnswer() {
    console.log('[QuizPage] Auto-submitting due to timer expiration');
    this.stopTimer();
    
    // If no answer selected, submit without selection
    if (!this.selected && this.currentQuestion) {
      this.snackBar.open('⏱️ Time\'s up! Moving to next question...', 'Close', { duration: 2000 });
      await this.moveToNextQuestion();
    } else {
      await this.submitAnswer(true);
    }
  }

  async submitAnswer(isAutoSubmit: boolean = false) {
    console.log('[QuizPage] submitAnswer called. selected =', this.selected, 'isAutoSubmit =', isAutoSubmit);
    if (!this.currentQuestion || this.submitting) return;

    try {
      const currentQuestionDetail = this.questionDetails[this.currentIndex];
      
      // Handle unanswered question
      if (!this.selected) {
        console.log('[QuizPage] No answer selected - submitting as unanswered');
        const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));
        
        const request: SubmitAnswerRequest = {
          participantId: this.participantId,
          questionId: currentQuestionDetail.questionId,
          selectedOptionId: 0, // 0 indicates unanswered
          timeSpentSeconds: timeSpent
        };

        this.submitting = true;
        const response = await this.participantService.submitParticipantAnswer(request);
        this.submitting = false;

        if (isAutoSubmit) {
          this.snackBar.open('⏰ Time\'s up! Question marked as unanswered.', 'Close', { duration: 2000 });
        }

        this.waitingForNext = true;
        return;
      }
      
      const selectedOption = currentQuestionDetail.options.find(o => o.optionText === this.selected);

      if (!selectedOption) {
        console.error('Selected option not found');
        return;
      }

      const timeSpent = Math.max(0, Math.floor((this.getServerNowMs() - this.currentQuestionStartMs) / 1000));

      const request: SubmitAnswerRequest = {
        participantId: this.participantId,
        questionId: currentQuestionDetail.questionId,
        selectedOptionId: selectedOption.optionId,
        timeSpentSeconds: timeSpent
      };

      this.submitting = true;
      const response = await this.participantService.submitParticipantAnswer(request);
      this.submitting = false;

      // Show success popup for manual submit
      if (!isAutoSubmit) {
        this.snackBar.open('✅ Answer submitted successfully!', 'Close', { duration: 1500 });
      }

      if (response.isCorrect) {
        this.score += 1;
        if (!isAutoSubmit) {
          this.snackBar.open('🎉 Correct!', 'Close', { duration: 1500 });
        }
      } else {
        const correctOption = currentQuestionDetail.options.find(o => o.optionId === response.correctOptionId);
        if (!isAutoSubmit) {
          this.snackBar.open(`❌ Incorrect. Correct answer: ${correctOption?.optionText}`, 'Close', { duration: 2500 });
        }
      }

      // Move to next question after a brief delay
      setTimeout(() => {
        this.moveToNextQuestion();
      }, isAutoSubmit ? 0 : 1000);

    } catch (error: any) {
      this.submitting = false;
      console.error('[QuizPage] Error submitting answer:', error);
      this.snackBar.open('Failed to submit answer. Please try again.', 'Close', { duration: 3000 });
    }
  }

  async moveToNextQuestion() {
    // advance
    this.selected = null;
    this.waitingForNext = false;
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.currentQuestionStartMs = this.getServerNowMs();
      this.startTimer(); // Start timer for next question
      console.log('[QuizPage] advanced to index', this.currentIndex);
    } else {
      this.finished = true;
      console.log('[QuizPage] finished with score:', this.score);
      
      // Store final score
      localStorage.setItem('finalScore', this.score.toString());
      localStorage.setItem('totalQuestions', this.questions.length.toString());
    }
  }

  ngOnDestroy() {
    // Clean up timer on component destroy
    this.stopTimer();
  }

  getScorePercentage(): number {
    if (this.questions.length === 0) return 0;
    return Math.round((this.score / this.questions.length) * 100);
  }

  returnToParticipant() {
    // Save quiz and participant info for feedback
    const quizId = localStorage.getItem('currentQuizId');
    const participantId = localStorage.getItem('participantId');
    
    // Navigate to feedback page with query params
    this.router.navigate(['/feedback'], {
      queryParams: {
        quizId: quizId,
        participantId: participantId
      }
    });
  }

  restart() {
    this.currentIndex = 0;
    this.score = 0;
    this.selected = null;
    this.finished = false;
    this.stopTimer();
    this.startTimer();
    console.log('[QuizPage] restart');
  }

  private getServerNowMs(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  private updateQuestionState(): void {
    this.currentQuestionStartMs = this.getServerNowMs();
  }
}
