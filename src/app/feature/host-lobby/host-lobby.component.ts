import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

interface ParticipantProgress {
  totalParticipants: number;
  submittedCount: number;
  percentage: number;
}

interface QuestionTimer {
  questionId: number;
  remainingSeconds: number;
  totalSeconds: number;
}

interface SessionData {
  sessionId: number;
  sessionCode: string;
  quizName: string;
  startedAt?: string;
  endedAt?: string;
  status: string;
  totalQuestions: number;
}

interface QuestionData {
  questionId: number;
  questionText: string;
  timerSeconds: number;
  questionNumber: number;
}

@Component({
  selector: 'app-host-lobby',
  templateUrl: './host-lobby.component.html',
  styleUrls: ['./host-lobby.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class HostLobbyComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  
  // SignalR Hub Connection
  private hubConnection?: signalR.HubConnection;
  
  // Component state
  sessionCode = signal<string>('');
  quizId = signal<number>(0);
  sessionId = signal<number>(0);
  mode = signal<'manual' | 'auto'>('manual');
  connectionStatus = signal<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Session and quiz state
  sessionData = signal<SessionData | null>(null);
  currentQuestion = signal<QuestionData | null>(null);
  allQuestions = signal<QuestionData[]>([]);
  quizStarted = signal<boolean>(false);
  waitingForStart = signal<boolean>(true);
  countdown = signal<number>(0);
  private countdownInterval: any;
  private questionTimerInterval: any;
  
  // Live quiz state
  currentQuestionId = signal<number>(1);
  participantProgress = signal<ParticipantProgress>({
    totalParticipants: 0,
    submittedCount: 0,
    percentage: 0
  });
  questionTimer = signal<QuestionTimer>({
    questionId: 1,
    remainingSeconds: 0,
    totalSeconds: 0
  });
  
  leaderboardVisible = signal<boolean>(false);
  quizEnded = signal<boolean>(false);
  jumpToQuestion: number = 1;
  
  // Prevent multiple end quiz calls
  private isEndingQuiz = false;
  
  // Computed properties
  progressPercentage = computed(() => this.participantProgress().percentage);
  timerProgress = computed(() => {
    const timer = this.questionTimer();
    if (timer.totalSeconds === 0) return 0;
    return (timer.remainingSeconds / timer.totalSeconds) * 100;
  });
  timerDisplay = computed(() => {
    const seconds = this.questionTimer().remainingSeconds;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  countdownDisplay = computed(() => {
    const seconds = this.countdown();
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  currentQuestionText = computed(() => this.currentQuestion()?.questionText || 'Loading...');
  currentQuestionNumber = computed(() => this.currentQuestion()?.questionNumber || 1);
  totalQuestions = computed(() => this.allQuestions().length);

  ngOnInit() {
    console.log('[HostLobby] Component initialized');
    // Get query parameters
    this.route.queryParams.subscribe(async params => {
      const code = params['sessionCode'] || '';
      const id = +params['quizId'] || 0;
      const mode = params['mode'] === 'auto' ? 'auto' : 'manual';
      
      console.log('[HostLobby] Params:', { sessionCode: code, quizId: id, mode });
      
      this.sessionCode.set(code);
      this.quizId.set(id);
      this.mode.set(mode);
      
      if (this.sessionCode()) {
        console.log('[HostLobby] Loading session data...');
        await this.loadSessionData();
        console.log('[HostLobby] Session loaded, initializing SignalR...');
        await this.initializeSignalR();
        console.log('[HostLobby] Initialization complete');
        console.log('[HostLobby] Final state - waiting:', this.waitingForStart(), 'started:', this.quizStarted(), 'countdown:', this.countdown());
      } else {
        this.snackBar.open('⚠️ No session code provided', 'Close', { duration: 4000 });
        this.router.navigate(['/host/manage-content']);
      }
    });
  }

  ngOnDestroy() {
    this.disconnectSignalR();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.questionTimerInterval) {
      clearInterval(this.questionTimerInterval);
    }
  }

  /**
   * Load session data and questions from backend
   */
  private async loadSessionData() {
    try {
      console.log('[HostLobby] Loading session data for code:', this.sessionCode());
      
      // Get session data using the host endpoint (Area-based route)
      const sessionResponse = await fetch(`http://localhost:5195/api/Host/QuizSession/by-code/${this.sessionCode()}`);
      
      if (!sessionResponse.ok) {
        console.error('[HostLobby] Session fetch failed:', sessionResponse.status, sessionResponse.statusText);
        throw new Error(`Failed to fetch session: ${sessionResponse.statusText}`);
      }
      
      const session = await sessionResponse.json();
      console.log('[HostLobby] Session data:', session);
      
      this.sessionId.set(session.sessionId);
      this.quizId.set(session.quizId);
      
      // Get quiz questions using the correct Area-based route
      const questionsResponse = await fetch(`http://localhost:5195/api/Participate/Session/${session.sessionId}/questions`);
      
      if (!questionsResponse.ok) {
        console.error('[HostLobby] Questions fetch failed:', questionsResponse.status, questionsResponse.statusText);
        throw new Error(`Failed to fetch questions: ${questionsResponse.statusText}`);
      }
      
      const data = await questionsResponse.json();
      console.log('[HostLobby] Questions data:', data);
      console.log('[HostLobby] Questions array:', data.questions);
      
      this.sessionData.set({
        sessionId: session.sessionId,
        sessionCode: session.sessionCode || this.sessionCode(),
        quizName: data.quizTitle || session.quizName || 'Quiz',
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        status: session.status || 'Active',
        totalQuestions: data.questions?.length || 0
      });
      
      // Map questions
      const questions: QuestionData[] = data.questions?.map((q: any, index: number) => ({
        questionId: q.questionId,
        questionText: q.questionText,
        timerSeconds: q.timerSeconds || 30,
        questionNumber: index + 1
      })) || [];
      
      this.allQuestions.set(questions);
      console.log('[HostLobby] Loaded questions:', questions.length);
      
      // Fetch current participant count
      try {
        const participantsResponse = await fetch(`http://localhost:5195/api/Host/QuizSession/${session.sessionId}/participants/count`);
        if (participantsResponse.ok) {
          const countData = await participantsResponse.json();
          const initialCount = countData.count || countData.participantCount || 0;
          console.log('[HostLobby] Initial participant count:', initialCount);
          this.participantProgress.update(p => ({
            ...p,
            totalParticipants: initialCount
          }));
        }
      } catch (error) {
        console.warn('[HostLobby] Could not fetch participant count:', error);
        // Will rely on SignalR update instead
      }
      
      if (questions.length > 0) {
        this.currentQuestion.set(questions[0]);
        this.currentQuestionId.set(questions[0].questionId);
        this.questionTimer.set({
          questionId: questions[0].questionId,
          remainingSeconds: questions[0].timerSeconds,
          totalSeconds: questions[0].timerSeconds
        });
        console.log('[HostLobby] Set current question:', questions[0].questionText);
      }
      
      // Check if quiz has started
      if (session.startedAt) {
        const startTime = new Date(session.startedAt).getTime();
        const now = Date.now();
        
        if (startTime <= now) {
          console.log('[HostLobby] Quiz already started');
          this.quizStarted.set(true);
          this.waitingForStart.set(false);
        } else {
          // Calculate countdown
          const secondsUntilStart = Math.floor((startTime - now) / 1000);
          console.log('[HostLobby] Quiz starts in', secondsUntilStart, 'seconds');
          this.countdown.set(secondsUntilStart);
          this.waitingForStart.set(true);
          this.quizStarted.set(false);
          this.startCountdown();
        }
      } else {
        console.log('[HostLobby] No start time set, entering waiting mode with default countdown');
        // No start time set, quiz is waiting to be started manually
        this.countdown.set(300); // 5 minutes default
        this.waitingForStart.set(true);
        this.quizStarted.set(false);
        this.startCountdown();
      }
    } catch (error) {
      console.error('[HostLobby] Failed to load session data:', error);
      this.snackBar.open('⚠️ Failed to load session data', 'Close', { duration: 4000 });
    }
  }

  /**
   * Start countdown timer to quiz start
   */
  private startCountdown() {
    console.log('[HostLobby] Starting countdown timer with initial value:', this.countdown());
    
    // Clear any existing interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = setInterval(async () => {
      const current = this.countdown();
      if (current <= 0) {
        console.log('[HostLobby] Countdown finished - starting quiz');
        clearInterval(this.countdownInterval);
        this.waitingForStart.set(false);
        this.quizStarted.set(true);
        
        // Always call forceStartQuiz to notify backend and participants
        await this.forceStartQuiz();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  /**
   * Start question timer countdown
   */
  private async startQuestionTimer() {
    console.log('[HostLobby] Starting question timer');
    
    // Clear any existing timer
    if (this.questionTimerInterval) {
      clearInterval(this.questionTimerInterval);
    }
    
    // Send initial timer sync immediately
    const timer = this.questionTimer();
    if (this.hubConnection && this.connectionStatus() === 'connected') {
      try {
        await this.hubConnection.invoke('BroadcastTimer', 
          this.sessionCode(), 
          timer.questionId, 
          timer.remainingSeconds, 
          timer.totalSeconds
        );
        console.log('[HostLobby] Sent initial timer sync:', timer.remainingSeconds, 'seconds');
      } catch (error) {
        console.error('[HostLobby] Failed to broadcast initial timer:', error);
      }
    }
    
    this.questionTimerInterval = setInterval(async () => {
      const timer = this.questionTimer();
      if (timer.remainingSeconds <= 0) {
        console.log('[HostLobby] Question timer expired');
        clearInterval(this.questionTimerInterval);
        
        // Always auto-advance to next question when timer expires (both auto and manual mode)
        const nextQuestionNumber = this.currentQuestionNumber() + 1;
        if (nextQuestionNumber <= this.totalQuestions()) {
          console.log('[HostLobby] Auto-advancing to question', nextQuestionNumber);
          try {
            await this.forceNavigate(nextQuestionNumber);
          } catch (error) {
            console.error('[HostLobby] Auto-advance failed:', error);
            // Continue locally even if SignalR fails
            this.snackBar.open('⚠️ Connection issue, advancing locally', 'Close', { duration: 2000 });
          }
        } else {
          console.log('[HostLobby] Last question completed - ending quiz');
          // Call manualEndQuiz to properly end the quiz and update database
          await this.manualEndQuiz(true); // Skip confirmation for auto-end
        }
      } else {
        this.questionTimer.update(t => ({
          ...t,
          remainingSeconds: t.remainingSeconds - 1
        }));
        
        // Broadcast timer update to all participants every second
        if (this.hubConnection && this.connectionStatus() === 'connected') {
          try {
            await this.hubConnection.invoke('BroadcastTimer', 
              this.sessionCode(), 
              timer.questionId, 
              timer.remainingSeconds - 1, 
              timer.totalSeconds
            );
          } catch (error) {
            console.error('[HostLobby] Failed to broadcast timer:', error);
          }
        }
      }
    }, 1000);
  }

  /**
   * Initialize SignalR connection for host lobby
   */
  private async initializeSignalR() {
    try {
      this.connectionStatus.set('connecting');
      
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl('http://localhost:5195/quizSessionHub', {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Add reconnection event handlers
      this.hubConnection.onreconnecting((error) => {
        console.warn('[HostLobby] SignalR reconnecting...', error);
        this.connectionStatus.set('connecting');
        this.snackBar.open('⚠️ Reconnecting...', 'Close', { duration: 2000 });
      });

      this.hubConnection.onreconnected(async (connectionId) => {
        console.log('[HostLobby] SignalR reconnected:', connectionId);
        this.connectionStatus.set('connected');
        
        // Rejoin groups after reconnection
        try {
          await this.hubConnection!.invoke('JoinHostSession', this.sessionCode());
          await this.hubConnection!.invoke('JoinSession', this.sessionCode());
          console.log('[HostLobby] Rejoined session groups after reconnection');
          this.snackBar.open('✅ Reconnected successfully', 'Close', { duration: 2000 });
        } catch (error) {
          console.error('[HostLobby] Failed to rejoin after reconnection:', error);
        }
      });

      this.hubConnection.onclose((error) => {
        console.error('[HostLobby] SignalR connection closed:', error);
        this.connectionStatus.set('disconnected');
        this.snackBar.open('⚠️ Connection lost', 'Close', { duration: 3000 });
      });

      // Register event handlers
      this.registerSignalRHandlers();

      // Start connection
      await this.hubConnection.start();
      console.log('[HostLobby] SignalR connected');
      
      // Join session as host (join host-specific group)
      await this.hubConnection.invoke('JoinHostSession', this.sessionCode());
      console.log('[HostLobby] Joined host session group');
      
      // Also join regular session group to receive QuizStarted events
      await this.hubConnection.invoke('JoinSession', this.sessionCode());
      console.log('[HostLobby] Joined regular session group');
      
      this.connectionStatus.set('connected');
      
      this.snackBar.open('🎮 Connected to quiz session', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('[HostLobby] SignalR connection failed:', error);
      this.connectionStatus.set('disconnected');
      this.snackBar.open('⚠️ Failed to connect to quiz session', 'Close', { duration: 4000 });
    }
  }

  /**
   * Register SignalR event handlers
   */
  private registerSignalRHandlers() {
    if (!this.hubConnection) return;

    // Listen for submission progress updates
    this.hubConnection.on('SubmissionProgressUpdate', (data: any) => {
      console.log('[HostLobby] Submission progress received:', data);
      const percentage = data.Percentage || data.percentage || 0;
      const totalParticipants = data.TotalParticipants || data.totalParticipants || 0;
      const submittedCount = data.SubmittedCount || data.submittedCount || 0;
      const questionId = data.QuestionId || data.questionId;
      
      // Only update if it's for the current question
      if (questionId === this.currentQuestionId()) {
        this.participantProgress.set({
          totalParticipants: totalParticipants,
          submittedCount: submittedCount,
          percentage: Math.round(percentage)
        });
        console.log('[HostLobby] Updated progress:', submittedCount, '/', totalParticipants, '(', percentage, '%)');
      }
    });

    // Listen for timer updates
    this.hubConnection.on('LiveTimerUpdate', (data: any) => {
      console.log('[HostLobby] Timer update:', data);
      const questionId = data.QuestionId;
      const remainingSeconds = data.RemainingSeconds;
      
      // Update timer
      this.questionTimer.set({
        questionId: questionId,
        remainingSeconds: remainingSeconds,
        totalSeconds: this.questionTimer().totalSeconds || remainingSeconds
      });
      
      // Update current question if it changed
      if (this.currentQuestionId() !== questionId) {
        this.currentQuestionId.set(questionId);
        const question = this.allQuestions().find(q => q.questionId === questionId);
        if (question) {
          this.currentQuestion.set(question);
          this.questionTimer.update(timer => ({
            ...timer,
            totalSeconds: question.timerSeconds
          }));
          console.log('[HostLobby] Switched to question:', question.questionNumber);
        }
      }
    });

    // Listen for quiz end confirmation (host-specific)
    this.hubConnection.on('QuizEndedConfirmation', (data: any) => {
      console.log('[HostLobby] Quiz ended confirmation received:', data);
      // Don't show snackbar here - it's already shown in manualEndQuiz
      // Just ensure state is set
      if (!this.quizEnded()) {
        this.quizEnded.set(true);
      }
    });

    // Listen for participant count updates
    this.hubConnection.on('ParticipantCountUpdated', (count: number) => {
      const current = this.participantProgress();
      this.participantProgress.set({
        ...current,
        totalParticipants: count
      });
      console.log('[HostLobby] Participant count:', count);
    });

    // Listen for quiz started confirmation
    this.hubConnection.on('QuizStarted', async (sessionCode: string) => {
      console.log('[HostLobby] QuizStarted event received for:', sessionCode);
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      // Start timer for first question
      if (this.currentQuestion()) {
        await this.startQuestionTimer();
      }
      console.log('[HostLobby] State updated - waiting:', this.waitingForStart(), 'started:', this.quizStarted());
    });
  }

  /**
   * Force navigate all participants to specific question
   */
  async forceNavigate(questionIdOrNumber: number) {
    if (!this.hubConnection || this.connectionStatus() !== 'connected') {
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      console.log('[HostLobby] Force navigate to:', questionIdOrNumber);
      console.log('[HostLobby] Available questions:', this.allQuestions());
      
      // Find the question - could be by ID or by question number (1-indexed)
      let question = this.allQuestions().find(q => q.questionId === questionIdOrNumber);
      
      if (!question) {
        // Try finding by question number instead
        question = this.allQuestions().find(q => q.questionNumber === questionIdOrNumber);
      }
      
      if (!question) {
        console.error('[HostLobby] Question not found:', questionIdOrNumber);
        this.snackBar.open(`⚠️ Question ${questionIdOrNumber} not found`, 'Close', { duration: 3000 });
        return;
      }
      
      await this.hubConnection.invoke('ForceNavigate', this.sessionCode(), question.questionId);
      
      // Also send initial timer to sync immediately
      await this.hubConnection.invoke('BroadcastTimer', 
        this.sessionCode(), 
        question.questionId, 
        question.timerSeconds, 
        question.timerSeconds
      );
      console.log('[HostLobby] Sent initial timer sync for question', question.questionNumber);
      
      this.currentQuestionId.set(question.questionId);
      this.currentQuestion.set(question);
      
      // Reset participant progress for new question
      this.participantProgress.update(p => ({
        ...p,
        submittedCount: 0,
        percentage: 0
      }));
      
      // Start/reset the question timer
      this.questionTimer.set({
        questionId: question.questionId,
        remainingSeconds: question.timerSeconds,
        totalSeconds: question.timerSeconds
      });
      await this.startQuestionTimer();
      
      this.snackBar.open(`✅ All participants moved to Question ${question.questionNumber}`, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('[HostLobby] Force navigate failed:', error);
      this.snackBar.open('⚠️ Failed to force navigate', 'Close', { duration: 3000 });
    }
  }

  /**
   * Force start the quiz (manual mode)
   */
  async forceStartQuiz() {
    if (!this.hubConnection || this.connectionStatus() !== 'connected') {
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      console.log('[HostLobby] Force starting quiz for session:', this.sessionCode());
      
      // Update session startedAt in backend and notify all participants
      await this.hubConnection.invoke('NotifyQuizStart', this.sessionCode());
      
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      
      // Start the first question timer immediately after quiz starts
      if (this.currentQuestion()) {
        console.log('[HostLobby] Starting timer for first question');
        await this.startQuestionTimer();
      }
      
      this.snackBar.open('🚀 Quiz started! Participants can now begin.', 'Close', { duration: 4000 });
      console.log('[HostLobby] Quiz started successfully');
    } catch (error) {
      console.error('[HostLobby] Force start failed:', error);
      this.snackBar.open('⚠️ Failed to start quiz', 'Close', { duration: 3000 });
    }
  }

  /**
   * Toggle between Auto and Manual mode
   */
  toggleMode() {
    const newMode = this.mode() === 'auto' ? 'manual' : 'auto';
    this.mode.set(newMode);
    
    const message = newMode === 'manual' 
      ? '🎮 Manual Mode: You control everything' 
      : '🤖 Auto Mode: Quiz runs automatically';
    
    this.snackBar.open(message, 'Close', { duration: 3000 });
  }

  /**
   * Toggle leaderboard visibility for participants
   */
  async toggleLeaderboard() {
    if (!this.hubConnection || this.connectionStatus() !== 'connected') {
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      const newVisibility = !this.leaderboardVisible();
      await this.hubConnection.invoke('ToggleLeaderboard', this.sessionCode(), newVisibility);
      this.leaderboardVisible.set(newVisibility);
      
      const message = newVisibility ? '👁️ Leaderboard shown to participants' : '🔒 Leaderboard hidden from participants';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('[HostLobby] Toggle leaderboard failed:', error);
      this.snackBar.open('⚠️ Failed to toggle leaderboard', 'Close', { duration: 3000 });
    }
  }

  /**
   * Manually end the quiz
   */
  async manualEndQuiz(skipConfirmation: boolean = false) {
    // Prevent multiple executions
    if (this.isEndingQuiz) {
      console.log('[HostLobby] Quiz already ending, skipping duplicate call');
      return;
    }
    
    this.isEndingQuiz = true;
    
    if (!skipConfirmation) {
      const confirmed = confirm('⚠️ Are you sure you want to end this quiz? This action cannot be undone.');
      if (!confirmed) {
        this.isEndingQuiz = false;
        return;
      }
    }

    try {
      // Stop any running timers FIRST to prevent re-triggering
      if (this.questionTimerInterval) {
        clearInterval(this.questionTimerInterval);
        this.questionTimerInterval = null;
        console.log('[HostLobby] Timer interval cleared');
      }
      
      // Always set local state
      this.quizEnded.set(true);
      
      // Check connection and try to notify backend
      if (this.hubConnection && this.connectionStatus() === 'connected') {
        await this.hubConnection.invoke('ManualEnd', this.sessionCode());
        console.log('[HostLobby] Successfully sent ManualEnd to backend');
      } else {
        console.warn('[HostLobby] Not connected to SignalR, ending quiz locally only');
        // Still end the quiz locally even if SignalR is disconnected
        if (!skipConfirmation) {
          this.snackBar.open('⚠️ Connection lost, ending quiz locally', 'Close', { duration: 3000 });
        }
      }
      
      // Show brief success message and navigate immediately
      this.snackBar.open('✅ Quiz ended - Redirecting...', 'Close', { duration: 1500 });
      
      // Navigate to results immediately
      setTimeout(() => {
        this.router.navigate(['/results-analysis'], {
          queryParams: { sessionCode: this.sessionCode() }
        });
      }, 500); // Short delay to allow snackbar to show
    } catch (error) {
      console.error('[HostLobby] Manual end failed:', error);
      
      // Even if backend call fails, still end quiz locally for host
      this.quizEnded.set(true);
      
      if (skipConfirmation) {
        // Auto-end from timer - still navigate to results
        this.snackBar.open('⚠️ Quiz ended - Redirecting...', 'Close', { duration: 1500 });
        setTimeout(() => {
          this.router.navigate(['/results-analysis'], {
            queryParams: { sessionCode: this.sessionCode() }
          });
        }, 500);
      } else {
        // Manual end - show error
        this.snackBar.open('⚠️ Failed to end quiz on server', 'Close', { duration: 3000 });
      }
    }
  }

  /**
   * View real-time leaderboard (host only)
   */
  viewLeaderboard() {
    this.router.navigate(['/host/leaderboard'], {
      queryParams: { sessionCode: this.sessionCode() }
    });
  }

  /**
   * Disconnect from SignalR
   */
  private async disconnectSignalR() {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
        console.log('[HostLobby] SignalR disconnected');
      } catch (error) {
        console.error('[HostLobby] Error disconnecting:', error);
      }
    }
  }
}
