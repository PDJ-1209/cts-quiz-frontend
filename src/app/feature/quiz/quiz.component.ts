import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ParticipantService } from '../../services/participant.service';
import { QuestionDetail, SubmitAnswerRequest } from '../../models/participant.models';
import { environment } from '../../../environments/environment';
import * as signalR from '@microsoft/signalr';

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

  participantId: number = 0;
  sessionId: number = 0;
  quizTitle: string = '';
  sessionCode: string = '';
  participantName: string = '';

  // Timer properties
  timeRemaining: number = 30;
  // Remove syncInterval - we'll use SignalR timer sync instead
  serverTimeOffsetMs: number = 0;
  startedAtMs: number = 0;
  currentQuestionStartMs: number = 0;
  currentQuestionEndMs: number = 0;
  waitingForNext: boolean = false;
  submittedIndex: number | null = null;
  private lastBackWarnAt = 0;
  private timerSyncEnabled: boolean = false; // Track if we're using host's timer

  private hubConnection?: signalR.HubConnection;

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

      const serverTimeMs = response.serverTime ? new Date(response.serverTime).getTime() : Date.now();
      this.serverTimeOffsetMs = serverTimeMs - Date.now();
      this.startedAtMs = response.startedAt ? new Date(response.startedAt).getTime() : serverTimeMs;
      // Don't call updateQuestionState() - let SignalR control timer and navigation
      console.log('[QuizPage] Session synced - waiting for SignalR updates');
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

      const serverTimeMs = response.serverTime ? new Date(response.serverTime).getTime() : Date.now();
      this.serverTimeOffsetMs = serverTimeMs - Date.now();
      this.startedAtMs = response.startedAt ? new Date(response.startedAt).getTime() : serverTimeMs;
      this.loading = false;

      // Initialize SignalR live sync (timer sync handled via SignalR)
      this.initializeSignalR();

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

  private getServerNowMs(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  // Remove startSyncTimer and stopSyncTimer - using SignalR instead

  private calculateQuestionState(serverNowMs: number): {
    index: number;
    remainingSeconds: number;
    questionStartMs: number;
    questionEndMs: number;
    finished: boolean;
  } {
    if (this.questions.length === 0) {
      return {
        index: 0,
        remainingSeconds: 0,
        questionStartMs: serverNowMs,
        questionEndMs: serverNowMs,
        finished: true
      };
    }

    const effectiveStartMs = this.startedAtMs || serverNowMs;
    const normalizedNowMs = Math.max(serverNowMs, effectiveStartMs);
    const elapsedSeconds = Math.max(0, Math.floor((normalizedNowMs - effectiveStartMs) / 1000));

    let cumulativeSeconds = 0;
    for (let i = 0; i < this.questions.length; i++) {
      const duration = this.questions[i]?.timerSeconds || 30;
      const questionStartMs = effectiveStartMs + cumulativeSeconds * 1000;
      const questionEndMs = questionStartMs + duration * 1000;

      if (elapsedSeconds < cumulativeSeconds + duration) {
        const remainingSeconds = Math.max(0, Math.ceil((questionEndMs - normalizedNowMs) / 1000));
        return {
          index: i,
          remainingSeconds,
          questionStartMs,
          questionEndMs,
          finished: false
        };
      }

      cumulativeSeconds += duration;
    }

    return {
      index: this.questions.length - 1,
      remainingSeconds: 0,
      questionStartMs: effectiveStartMs + cumulativeSeconds * 1000,
      questionEndMs: effectiveStartMs + cumulativeSeconds * 1000,
      finished: true
    };
  }

  private initializeSignalR(): void {
    if (!this.sessionCode || this.hubConnection) return;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.signalRUrl, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    // Add reconnection event handlers
    this.hubConnection.onreconnecting((error) => {
      console.warn('[QuizPage] SignalR reconnecting...', error);
      this.snackBar.open('⚠️ Reconnecting...', 'Close', { duration: 2000 });
    });

    this.hubConnection.onreconnected(async (connectionId) => {
      console.log('[QuizPage] SignalR reconnected:', connectionId);
      
      // Rejoin session after reconnection
      try {
        await this.hubConnection!.invoke('JoinSession', this.sessionCode);
        console.log('[QuizPage] Rejoined session after reconnection');
        this.snackBar.open('✅ Reconnected', 'Close', { duration: 2000 });
      } catch (error) {
        console.error('[QuizPage] Failed to rejoin after reconnection:', error);
      }
    });

    this.hubConnection.onclose((error) => {
      console.error('[QuizPage] SignalR connection closed:', error);
      this.snackBar.open('⚠️ Connection lost', 'Close', { duration: 3000 });
    });

    this.hubConnection.on('SessionSync', (payload: any) => {
      const serverTime = payload?.ServerTime ?? payload?.serverTime;
      const startedAt = payload?.StartedAt ?? payload?.startedAt;

      if (serverTime) {
        const serverTimeMs = new Date(serverTime).getTime();
        this.serverTimeOffsetMs = serverTimeMs - Date.now();
      }

      if (startedAt) {
        this.startedAtMs = new Date(startedAt).getTime();
      }

      // Don't call updateQuestionState() - let ForceNavigateToQuestion and TimerSync events control state
      console.log('[QuizPage] SessionSync received - timer sync enabled:', this.timerSyncEnabled);
    });

    // Host forces navigation to specific question - FULL SYNC
    this.hubConnection.on('ForceNavigateToQuestion', (data: any) => {
      console.log('[QuizPage] ===== HOST FORCED NAVIGATION =====');
      console.log('[QuizPage] Received data:', JSON.stringify(data));
      console.log('[QuizPage] Current timerSyncEnabled:', this.timerSyncEnabled);
      console.log('[QuizPage] Current index:', this.currentIndex);
      console.log('[QuizPage] Question details count:', this.questionDetails.length);
      
      const questionId = data?.QuestionId ?? data?.questionId;
      console.log('[QuizPage] Extracted questionId:', questionId);
      
      if (questionId) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        console.log('[QuizPage] Target index found:', targetIndex);
        
        if (targetIndex !== -1) {
          console.log('[QuizPage] ✅ Navigating from Q', this.currentIndex + 1, 'to Q', targetIndex + 1);
          
          // Enable timer sync mode
          this.timerSyncEnabled = true;
          
          // Update index immediately
          this.currentIndex = targetIndex;
          this.selected = null;
          this.submittedIndex = null;
          this.waitingForNext = false;
          
          // Reset timer to question's duration
          const currentQ = this.questionDetails[targetIndex];
          if (currentQ) {
            this.timeRemaining = currentQ.timerSeconds || 30;
            console.log('[QuizPage] ✅ Timer reset to', this.timeRemaining, 'seconds');
            console.log('[QuizPage] Question text:', currentQ.questionText);
          }
          
          this.snackBar.open(`📝 Question ${targetIndex + 1}`, 'Close', { duration: 1500 });
        } else {
          console.error('[QuizPage] ❌ Question not found with ID:', questionId);
        }
      } else {
        console.error('[QuizPage] ❌ No questionId in data');
      }
    });

    // Timer sync from host - MASTER TIMER
    this.hubConnection.on('TimerSync', (data: any) => {
      const questionId = data?.QuestionId ?? data?.questionId;
      const remainingSeconds = data?.RemainingSeconds ?? data?.remainingSeconds;
      
      if (this.timerSyncEnabled && questionId !== undefined && remainingSeconds !== undefined) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        if (targetIndex === this.currentIndex && targetIndex !== -1) {
          this.timeRemaining = Math.max(0, remainingSeconds);
          // Log every 5 seconds to avoid spam
          if (remainingSeconds % 5 === 0 || remainingSeconds <= 5) {
            console.log('[QuizPage] ⏱️ Timer synced:', this.timeRemaining, 's for Q', targetIndex + 1);
          }
        } else if (targetIndex !== this.currentIndex) {
          console.log('[QuizPage] ⚠️ Timer sync for different question. Current:', this.currentIndex + 1, 'Timer for:', targetIndex + 1);
        }
      } else if (!this.timerSyncEnabled) {
        console.log('[QuizPage] ⚠️ Timer sync received but sync not enabled yet');
      }
    });

    // Question started event with timer
    this.hubConnection.on('QuestionStarted', (data: any) => {
      console.log('[QuizPage] Question started:', data);
      const questionId = data?.QuestionId ?? data?.questionId;
      const timerSeconds = data?.TimerSeconds ?? data?.timerSeconds ?? 30;
      
      if (questionId) {
        const targetIndex = this.questionDetails.findIndex(q => q.questionId === questionId);
        if (targetIndex !== -1) {
          this.currentIndex = targetIndex;
          this.timeRemaining = timerSeconds;
          this.selected = null;
          this.submittedIndex = null;
          this.waitingForNext = false;
        }
      }
    });

    // Host toggles leaderboard visibility
    this.hubConnection.on('LeaderboardVisibilityToggled', (data: any) => {
      console.log('[QuizPage] Leaderboard visibility toggled:', data);
      const isVisible = data?.IsVisible ?? data?.isVisible;
      if (isVisible) {
        this.snackBar.open('📊 Leaderboard is now visible', 'Close', { duration: 2000 });
      } else {
        this.snackBar.open('📊 Leaderboard is now hidden', 'Close', { duration: 2000 });
      }
    });

    // Host manually ended the quiz
    this.hubConnection.on('QuizEnded', (data: any) => {
      console.log('[QuizPage] ===== QUIZ ENDED BY HOST =====');
      console.log('[QuizPage] Data received:', JSON.stringify(data));
      console.log('[QuizPage] Current finished status:', this.finished);
      console.log('[QuizPage] Current score:', this.score, '/', this.questions.length);
      
      this.finished = true;
      this.timerSyncEnabled = false;
      this.snackBar.open('🏁 Quiz has been ended by the host', 'Close', { duration: 3000 });
      
      // Save final state
      localStorage.setItem('finalScore', this.score.toString());
      localStorage.setItem('totalQuestions', this.questions.length.toString());
      
      console.log('[QuizPage] ✅ Navigating to feedback page in 2 seconds...');
      
      // Navigate to feedback/results after a short delay
      setTimeout(() => {
        console.log('[QuizPage] ✅ Executing navigation to feedback...');
        this.returnToParticipant();
      }, 2000);
    });

    // Quiz started event
    this.hubConnection.on('QuizStarted', (sessionCode: string) => {
      console.log('[QuizPage] ===== QUIZ STARTED =====', sessionCode);
      this.timerSyncEnabled = true; // Reinforce timer sync is enabled
      console.log('[QuizPage] ✅ Timer sync confirmed enabled');
      this.snackBar.open('🚀 Quiz has started!', 'Close', { duration: 2000 });
    });

    this.hubConnection.start()
      .then(() => {
        console.log('[QuizPage] ✅ SignalR connected successfully');
        console.log('[QuizPage] Session Code:', this.sessionCode);
        console.log('[QuizPage] Participant ID:', this.participantId);
        
        // Enable timer sync immediately when connecting - don't wait for QuizStarted
        // This ensures first question timer syncs properly
        this.timerSyncEnabled = true;
        console.log('[QuizPage] ✅ Timer sync enabled on connection');
        
        return this.hubConnection?.invoke('JoinSession', this.sessionCode);
      })
      .then(() => {
        console.log('[QuizPage] ✅ Successfully joined session group:', this.sessionCode);
      })
      .catch((err: unknown) => {
        console.error('[QuizPage] ❌ SignalR error:', err);
        this.snackBar.open('⚠️ Connection error. Some features may not work.', 'Close', { duration: 3000 });
      });
  }

  private updateQuestionState(): void {
    // Skip if using SignalR timer sync - let host control everything
    if (this.timerSyncEnabled) {
      console.log('[QuizPage] Skipping updateQuestionState - using SignalR sync');
      return;
    }
    
    const serverNowMs = this.getServerNowMs();
    const state = this.calculateQuestionState(serverNowMs);

    if (state.finished) {
      if (!this.finished) {
        this.finished = true;
        this.timerSyncEnabled = false; // Disable timer sync when quiz finishes
        localStorage.setItem('finalScore', this.score.toString());
        localStorage.setItem('totalQuestions', this.questions.length.toString());
      }
      return;
    }

    this.currentQuestionStartMs = state.questionStartMs;
    this.currentQuestionEndMs = state.questionEndMs;
    this.timeRemaining = state.remainingSeconds;

    if (this.currentIndex !== state.index) {
      this.currentIndex = state.index;
      this.selected = null;
      this.submittedIndex = null;
      this.waitingForNext = false;
    }

    if (this.submittedIndex === this.currentIndex) {
      this.waitingForNext = true;
    }
  }

  async submitAnswer(isAutoSubmit: boolean = false) {
    console.log('[QuizPage] submitAnswer called. selected =', this.selected, 'isAutoSubmit =', isAutoSubmit);
    if (!this.currentQuestion || this.submitting || this.waitingForNext || this.submittedIndex === this.currentIndex) return;

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

        this.submittedIndex = this.currentIndex;
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

      this.submittedIndex = this.currentIndex;
      this.waitingForNext = true;
      this.selected = null;

    } catch (error: any) {
      this.submitting = false;
      console.error('[QuizPage] Error submitting answer:', error);
      this.snackBar.open('Failed to submit answer. Please try again.', 'Close', { duration: 3000 });
    }
  }

  ngOnDestroy() {
    // Clean up on component destroy
    this.timerSyncEnabled = false;

    if (this.hubConnection) {
      if (this.sessionCode) {
        this.hubConnection.invoke('LeaveSession', this.sessionCode);
      }
      this.hubConnection.stop();
      this.hubConnection = undefined;
    }
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
    this.timerSyncEnabled = false; // Reset timer sync on restart
    console.log('[QuizPage] restart');
  }
}
