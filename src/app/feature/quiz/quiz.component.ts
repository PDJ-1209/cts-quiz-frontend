import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgClass, NgFor } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ParticipantService } from '../../services/participant.service';
import { QuestionDetail, SubmitAnswerRequest } from '../../models/participant.models';

import { HeaderComponent } from '../header/header.component';
import { QuestionComponent } from '../question/question.component';
import { OptionsComponent } from '../options/options.component';
import { SubmitComponent } from '../submit/submit.component';

type Question = { id: string; text: string; options: string[]; answer: string; timerSeconds: number; };

@Component({
  selector: 'app-quiz-page',
  standalone: true,
  imports: [
    HeaderComponent, QuestionComponent, OptionsComponent, SubmitComponent,
    NgIf, NgClass, NgFor, MatSnackBarModule
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

  participantId: number = 0;
  sessionId: number = 0;
  quizTitle: string = '';
  startTime: number = 0;

  // Timer properties
  timeRemaining: number = 30;
  timerInterval: any = null;

  private snackBar = inject(MatSnackBar);
  private participantService = inject(ParticipantService);
  router = inject(Router);

  async ngOnInit() {
    // Get participant and session data from localStorage
    const participantIdStr = localStorage.getItem('participantId');
    const sessionIdStr = localStorage.getItem('sessionId');
    const quizTitleStr = localStorage.getItem('quizTitle');

    if (!participantIdStr || !sessionIdStr) {
      this.snackBar.open('No session found. Please join a quiz first.', 'Close', { duration: 3000 });
      this.router.navigate(['/participant']);
      return;
    }

    this.participantId = parseInt(participantIdStr);
    this.sessionId = parseInt(sessionIdStr);
    this.quizTitle = quizTitleStr || 'Quiz';

    await this.loadQuestions();
  }

  async loadQuestions() {
    try {
      this.loading = true;
      const response = await this.participantService.getSessionQuestions(this.sessionId);
      
      this.questionDetails = response.questions;
      this.quizTitle = response.quizTitle;

      // Convert to the format expected by the existing components
      this.questions = response.questions.map(q => ({
        id: q.questionId.toString(),
        text: q.questionText,
        options: q.options.map(o => o.optionText),
        answer: '', // We don't show the answer to participants
        timerSeconds: q.timerSeconds || 30
      }));

      this.startTime = Date.now();
      this.loading = false;

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

    // Stop the timer
    this.stopTimer();

    // If no selection, just move to next question
    if (!this.selected) {
      await this.moveToNextQuestion();
      return;
    }

    try {
      const currentQuestionDetail = this.questionDetails[this.currentIndex];
      const selectedOption = currentQuestionDetail.options.find(o => o.optionText === this.selected);

      if (!selectedOption) {
        console.error('Selected option not found');
        return;
      }

      const timeSpent = Math.floor((Date.now() - this.startTime) / 1000);

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
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.startTime = Date.now(); // Reset timer for next question
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
    // Clear session data
    localStorage.removeItem('participantId');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('quizTitle');
    localStorage.removeItem('finalScore');
    localStorage.removeItem('totalQuestions');
    
    this.router.navigate(['/participant']);
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
}
