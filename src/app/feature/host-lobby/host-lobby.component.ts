import { Component, OnInit, OnDestroy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { LeaderboardService } from '../../services/leaderboard.service';

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
  private leaderboardService = inject(LeaderboardService);
  
  // SignalR Hub Connection
  private hubConnection?: signalR.HubConnection;
  
  // Component state
  sessionCode = signal<string>('');
  quizId = signal<number>(0);
  sessionId = signal<number>(0);
  mode = signal<'manual' | 'auto'>('auto'); // Start in auto mode
  connectionStatus = signal<'connecting' | 'connected' | 'disconnected'>('connecting');
  hostJustJoined = signal<boolean>(false); // Track if host just joined mid-session
  
  // Session and quiz state
  sessionData = signal<SessionData | null>(null);
  currentQuestion = signal<QuestionData | null>(null);
  allQuestions = signal<QuestionData[]>([]);
  quizStarted = signal<boolean>(false);
  waitingForStart = signal<boolean>(true);
  countdown = signal<number>(0);
  private countdownInterval: any;
  private questionTimerInterval: any;
  private isProcessingTimerExpiry: boolean = false; // Prevent re-entry
  private processedTimerExpiries = new Set<number>(); // Track which questions have had timer expiry handled
  
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
  showLeaderboardAfterQuestion = signal<boolean>(false);
  showLeaderboardAtEndOnly = signal<boolean>(false);
  quizEnded = signal<boolean>(false);
  jumpToQuestion: number = 1;
  
  // Leaderboard overlay for host view
  showLeaderboardOverlay = signal<boolean>(false);
  leaderboardData = signal<any>(null);
  isLoadingLeaderboard = signal<boolean>(false);
  leaderboardDisplayDuration = signal<number>(5); // Default 5 seconds
  
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

  constructor() {
    // Watch for timer expiration and handle leaderboard/question advancement
    effect(() => {
      const timer = this.questionTimer();
      const isStarted = this.quizStarted();
      const isEnded = this.quizEnded();
      
      // Only process if quiz is active and timer has expired (0 or below)
      if (isStarted && !isEnded && timer.remainingSeconds <= 0 && timer.totalSeconds > 0) {
        // Check if this question's timer expiry was already processed
        if (this.processedTimerExpiries.has(timer.questionId)) {
          console.log('[HostLobby] Timer expiry already processed for question:', timer.questionId, '- skipping');
          return;
        }
        
        // Prevent multiple triggers
        if (!this.isProcessingTimerExpiry) {
          this.isProcessingTimerExpiry = true;
          console.log('[HostLobby] Timer expired for question:', timer.questionId, 'remaining:', timer.remainingSeconds);
          
          // Mark this question as processed
          this.processedTimerExpiries.add(timer.questionId);
          
          // Use setTimeout to break out of the effect context
          setTimeout(() => {
            this.handleTimerExpiry().finally(() => {
              this.isProcessingTimerExpiry = false;
            });
          }, 0);
        }
      }
    });
  }

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
      
      // ✅ SET LEADERBOARD SETTINGS FROM SESSION DATA
      if (session.showLeaderboardAfterQuestion !== undefined) {
        this.showLeaderboardAfterQuestion.set(session.showLeaderboardAfterQuestion);
        console.log('[HostLobby] ShowLeaderboardAfterQuestion:', session.showLeaderboardAfterQuestion);
      }
      if (session.showLeaderboardAtEndOnly !== undefined) {
        this.showLeaderboardAtEndOnly.set(session.showLeaderboardAtEndOnly);
        console.log('[HostLobby] ShowLeaderboardAtEndOnly:', session.showLeaderboardAtEndOnly);
      }
      
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
        
        // ✅ CHECK IF TIMER DATA EXISTS IN SESSION (quiz already started)
        if (session.currentQuestionId && session.currentQuestionStartTime && session.timerDurationSeconds) {
          console.log('[HostLobby] Quiz already in progress - syncing timer from session data');
          
          // Calculate remaining time from session data
          const startTime = new Date(session.currentQuestionStartTime).getTime();
          const now = Date.now();
          const elapsed = (now - startTime) / 1000; // seconds
          const remaining = Math.max(0, Math.floor(session.timerDurationSeconds - elapsed));
          
          // Find the current question from session
          const currentQ = questions.find(q => q.questionId === session.currentQuestionId);
          if (currentQ) {
            this.currentQuestion.set(currentQ);
            this.currentQuestionId.set(currentQ.questionId);
          }
          
          this.questionTimer.set({
            questionId: session.currentQuestionId,
            remainingSeconds: remaining,
            totalSeconds: session.timerDurationSeconds
          });
          
          console.log('[HostLobby] Timer synced from session - Remaining:', remaining, 'Total:', session.timerDurationSeconds);
        } else {
          // No timer data in session, use default from question
          this.questionTimer.set({
            questionId: questions[0].questionId,
            remainingSeconds: questions[0].timerSeconds,
            totalSeconds: questions[0].timerSeconds
          });
          console.log('[HostLobby] Set default timer from question:', questions[0].timerSeconds);
        }
        
        const currentQ = this.currentQuestion();
        console.log('[HostLobby] Set current question:', currentQ?.questionText || 'N/A');
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
   * Start question timer with broadcast
   */
  private async startQuestionTimer() {
    console.log('[HostLobby] Timer managed by backend - no local timer started');
    // Timer is now managed by backend in AUTO mode
    // In MANUAL mode, host controls when to advance
    // Just display the timer updates from backend
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
      this.hubConnection.onreconnecting((error: Error | undefined) => {
        console.warn('⚠️ [DEBUG] SignalR reconnecting...');
        console.warn('   - Error:', error);
        console.warn('   - Session code:', this.sessionCode());
        this.connectionStatus.set('connecting');
        this.snackBar.open('⚠️ Reconnecting...', 'Close', { duration: 2000 });
      });

      this.hubConnection.onreconnected(async (connectionId: string | undefined) => {
        console.log('✅ [DEBUG] SignalR reconnected!');
        console.log('   - Connection ID:', connectionId);
        console.log('   - Session code:', this.sessionCode());
        this.connectionStatus.set('connected');
        
        // Rejoin groups after reconnection
        try {
          console.log('📡 [DEBUG] Rejoining session groups...');
          await this.hubConnection!.invoke('JoinHostSession', this.sessionCode());
          console.log('✅ [DEBUG] Rejoined host session group');
          await this.hubConnection!.invoke('JoinSession', this.sessionCode());
          console.log('✅ [DEBUG] Rejoined regular session group');
          this.snackBar.open('✅ Reconnected successfully', 'Close', { duration: 2000 });
        } catch (error) {
          console.error('❌ [DEBUG] Failed to rejoin after reconnection:', error);
        }
      });

      this.hubConnection.onclose((error: Error | undefined) => {
        console.error('❌ [DEBUG] SignalR connection closed!');
        console.error('   - Error:', error);
        console.error('   - Session code:', this.sessionCode());
        console.error('   - Was connected:', this.connectionStatus() === 'connected');
        this.connectionStatus.set('disconnected');
        this.snackBar.open('⚠️ Connection lost - Please refresh the page', 'Close', { duration: 5000 });
      });

      // Register event handlers
      this.registerSignalRHandlers();

      // Start connection
      await this.hubConnection.start();
      console.log('[HostLobby] SignalR connected');
      
      // Check if host is already present (rejoining)
      await this.hubConnection.invoke('CheckHostPresence', this.sessionCode());
      
      // Join session as host (join host-specific group)
      await this.hubConnection.invoke('JoinHostSession', this.sessionCode());
      console.log('[HostLobby] Joined host session group - switching to MANUAL mode');
      
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

    // Listen for host presence status (when rejoining mid-session)
    this.hubConnection.on('HostPresenceStatus', (data: any) => {
      console.log('[HostLobby] Host presence status received:', data);
      const hostPresent = data.HostPresent || data.hostPresent;
      const mode = data.Mode || data.mode || 'auto';
      
      if (!hostPresent) {
        // No other host present, we are in control
        this.mode.set('manual');
        this.hostJustJoined.set(false);
      }
    });

    // Listen for session state sync (current question, settings, etc.)
    this.hubConnection.on('SessionStateSync', (data: any) => {
      console.log('[HostLobby] Session state sync received:', data);
      const showAfterQuestion = data.ShowLeaderboardAfterQuestion ?? data.showLeaderboardAfterQuestion ?? false;
      const showAtEndOnly = data.ShowLeaderboardAtEndOnly ?? data.showLeaderboardAtEndOnly ?? false;
      const currentQuestionId = data.CurrentQuestionId ?? data.currentQuestionId;
      const remainingSeconds = data.RemainingSeconds ?? data.remainingSeconds ?? 0;
      const totalSeconds = data.TotalSeconds ?? data.totalSeconds ?? 0;
      
      this.showLeaderboardAfterQuestion.set(showAfterQuestion);
      this.showLeaderboardAtEndOnly.set(showAtEndOnly);
      this.mode.set('manual'); // Host joined, switch to manual
      this.hostJustJoined.set(true);
      
      // If there's a current question, sync to it
      if (currentQuestionId) {
        const question = this.allQuestions().find(q => q.questionId === currentQuestionId);
        if (question) {
          this.currentQuestion.set(question);
          this.currentQuestionId.set(currentQuestionId);
          
          // ✅ SYNC TIMER STATE
          this.questionTimer.set({
            questionId: currentQuestionId,
            remainingSeconds: Math.max(0, remainingSeconds),
            totalSeconds: totalSeconds > 0 ? totalSeconds : question.timerSeconds
          });
          
          console.log('[HostLobby] Synced to current question:', question.questionNumber, 'Timer:', remainingSeconds, '/', totalSeconds);
          
          // If quiz is active and timer is running, ensure we're in started state
          if (totalSeconds > 0 && remainingSeconds > 0) {
            this.quizStarted.set(true);
            this.waitingForStart.set(false);
          }
        }
      }
      
      this.snackBar.open('🎮 Switched to MANUAL mode - You are now in control', 'Close', { duration: 4000 });
    });

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

    // Listen to timer updates from backend
    this.hubConnection.on('LiveTimerUpdate', (data: any) => {
      const questionId = data.QuestionId || data.questionId;
      const remaining = data.RemainingSeconds || data.remainingSeconds || 0;
      const total = data.TotalSeconds || data.totalSeconds || 0;
      
      if (questionId === this.currentQuestionId()) {
        this.questionTimer.set({
          questionId: questionId,
          remainingSeconds: remaining,
          totalSeconds: total
        });
      }
    });

    // NOTE: Host does NOT listen to LiveTimerUpdate - it manages its own timer via setInterval
    // Only participants listen to LiveTimerUpdate to sync with host
    // Listening here would cause double updates (setInterval + SignalR = 2x speed)

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

    // ✅ Listen for successful join confirmations
    this.hubConnection.on('JoinedHostSession', (sessionCode: string) => {
      console.log('[HostLobby] Joined host session confirmed:', sessionCode);
    });

    this.hubConnection.on('JoinedSession', (sessionCode: string) => {
      console.log('[HostLobby] Joined regular session confirmed:', sessionCode);
    });

    this.hubConnection.on('SessionSync', (data: any) => {
      console.log('[HostLobby] Session sync received:', data);
    });

    // ✅ Listen for navigation events
    this.hubConnection.on('ForceNavigateToQuestion', (data: any) => {
      console.log('[HostLobby] Force navigate event received:', data);
      const questionId = data.QuestionId || data.questionId;
      if (questionId) {
        const question = this.allQuestions().find(q => q.questionId === questionId);
        if (question) {
          this.currentQuestion.set(question);
          this.currentQuestionId.set(questionId);
        }
      }
    });

    this.hubConnection.on('NavigationCommandSent', (questionId: number) => {
      console.log('[HostLobby] Navigation command confirmed for question:', questionId);
    });

    this.hubConnection.on('TimerSync', (data: any) => {
      console.log('[HostLobby] Timer sync received:', data);
      const questionId = data.QuestionId || data.questionId;
      const remaining = data.RemainingSeconds || data.remainingSeconds || 0;
      const total = data.TotalSeconds || data.totalSeconds || 0;
      
      if (questionId === this.currentQuestionId()) {
        this.questionTimer.set({
          questionId: questionId,
          remainingSeconds: remaining,
          totalSeconds: total
        });
      }
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
      // Pass TRUE for isForceStart parameter to override scheduled start time
      await this.hubConnection.invoke('NotifyQuizStart', this.sessionCode(), true);
      
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
      
      this.snackBar.open('🚀 Quiz FORCE STARTED! Start time updated to NOW.', 'Close', { duration: 4000 });
      console.log('[HostLobby] Quiz force started successfully');
    } catch (error) {
      console.error('[HostLobby] Force start failed:', error);
      this.snackBar.open('⚠️ Failed to start quiz', 'Close', { duration: 3000 });
    }
  }

  /**
   * Handle timer expiration - show leaderboard if enabled, then move to next question
   */
  private async handleTimerExpiry() {
    console.log('[HostLobby] Handling timer expiry...');
    console.log('[HostLobby] Show leaderboard after question:', this.showLeaderboardAfterQuestion());
    
    try {
      // Check if leaderboard should be shown
      if (this.showLeaderboardAfterQuestion()) {
        console.log('[HostLobby] Showing leaderboard before advancing...');
        
        // Fetch and display leaderboard
        if (this.sessionId() && this.currentQuestionId()) {
          this.isLoadingLeaderboard.set(true);
          const leaderboard = await this.leaderboardService.getLeaderboard(this.sessionId()).toPromise();
          this.leaderboardData.set(leaderboard);
          this.showLeaderboardOverlay.set(true);
          this.isLoadingLeaderboard.set(false);
          
          console.log('[HostLobby] Leaderboard displayed, broadcasting to participants...');
          
          // Broadcast leaderboard to participants via SignalR
          if (this.hubConnection) {
            const duration = this.leaderboardDisplayDuration();
            await this.hubConnection.invoke('ShowLeaderboardAfterQuestion', 
              this.sessionCode(), 
              this.currentQuestionId(), 
              duration
            );
            console.log('[HostLobby] Leaderboard broadcast to participants with duration:', duration);
          }
          
          // Wait for leaderboard display duration
          const duration = this.leaderboardDisplayDuration() * 1000;
          await new Promise(resolve => setTimeout(resolve, duration));
          
          // Close leaderboard
          this.showLeaderboardOverlay.set(false);
          this.leaderboardData.set(null);
          console.log('[HostLobby] Leaderboard closed, advancing to next question...');
        }
      }
      
      // Check if this is the last question
      const currentNum = this.currentQuestionNumber();
      const total = this.totalQuestions();
      
      if (currentNum >= total) {
        console.log('[HostLobby] Last question completed, ending quiz...');
        await this.manualEndQuiz();
      } else {
        // Move to next question
        console.log('[HostLobby] Moving to next question...');
        const nextQuestionNum = currentNum + 1;
        const nextQuestion = this.allQuestions().find(q => q.questionNumber === nextQuestionNum);
        
        if (nextQuestion && this.hubConnection) {
          await this.hubConnection.invoke('ForceNavigate', this.sessionCode(), nextQuestion.questionId);
          console.log('[HostLobby] Navigated to question:', nextQuestionNum);
        }
      }
    } catch (error) {
      console.error('[HostLobby] Error handling timer expiry:', error);
      this.snackBar.open('⚠️ Error advancing question', 'Close', { duration: 3000 });
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
   * Toggle show leaderboard after each question
   */
  async viewLeaderboard() {
    console.log('🔍 [DEBUG] viewLeaderboard called');
    console.log('   - Session ID:', this.sessionId());
    console.log('   - Session Code:', this.sessionCode());
    
    if (!this.sessionId()) {
      console.error('❌ [DEBUG] No session ID available');
      this.snackBar.open('⚠️ No active session', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isLoadingLeaderboard.set(true);
      console.log('📡 [DEBUG] Fetching leaderboard data...');
      
      const leaderboard = await this.leaderboardService.getLeaderboard(this.sessionId()).toPromise();
      console.log('✅ [DEBUG] Leaderboard data received:', leaderboard);
      
      this.leaderboardData.set(leaderboard);
      this.showLeaderboardOverlay.set(true);
      this.isLoadingLeaderboard.set(false);
      
      this.snackBar.open('📊 Leaderboard displayed', 'Close', { duration: 2000 });
    } catch (error) {
      console.error('❌ [DEBUG] Failed to load leaderboard:', error);
      this.isLoadingLeaderboard.set(false);
      this.snackBar.open('⚠️ Failed to load leaderboard', 'Close', { duration: 3000 });
    }
  }

  /**
   * Close leaderboard overlay
   */
  closeLeaderboardOverlay() {
    console.log('🔍 [DEBUG] Closing leaderboard overlay');
    this.showLeaderboardOverlay.set(false);
    this.leaderboardData.set(null);
  }

  /**
   * Toggle show leaderboard after each question
   */
  async toggleShowAfterQuestion() {
    console.log('🔍 [DEBUG] toggleShowAfterQuestion called');
    console.log('🔍 [DEBUG] Current setting:', this.showLeaderboardAfterQuestion());
    console.log('🔍 [DEBUG] End-only setting:', this.showLeaderboardAtEndOnly());
    
    if (!this.hubConnection || this.connectionStatus() !== 'connected') {
      console.error('❌ [DEBUG] Not connected to session');
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      const newSetting = !this.showLeaderboardAfterQuestion();
      console.log('📡 [DEBUG] New setting will be:', newSetting);
      
      // If enabling after-question, disable end-only mode
      if (newSetting) {
        console.log('🔧 [DEBUG] Disabling end-only mode');
        this.showLeaderboardAtEndOnly.set(false);
      }
      
      // Call backend to update setting
      console.log('📡 [DEBUG] Invoking SetShowLeaderboardAfterQuestion...');
      await this.hubConnection.invoke('SetShowLeaderboardAfterQuestion', this.sessionCode(), newSetting);
      console.log('✅ [DEBUG] Backend updated successfully');
      
      this.showLeaderboardAfterQuestion.set(newSetting);
      console.log('✅ [DEBUG] Local state updated to:', newSetting);
      
      const message = newSetting 
        ? '✅ Leaderboard will show after each question' 
        : '🔒 Leaderboard will NOT show after questions';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('❌ [DEBUG] Toggle show after question failed:', error);
      console.error('   - Error details:', JSON.stringify(error, null, 2));
      this.snackBar.open('⚠️ Failed to update setting', 'Close', { duration: 3000 });
    }
  }

  /**
   * Toggle show leaderboard at end only
   */
  async toggleShowAtEndOnly() {
    console.log('🔍 [DEBUG] toggleShowAtEndOnly called');
    console.log('🔍 [DEBUG] Current setting:', this.showLeaderboardAtEndOnly());
    console.log('🔍 [DEBUG] After-question setting:', this.showLeaderboardAfterQuestion());
    
    if (!this.hubConnection || this.connectionStatus() !== 'connected') {
      console.error('❌ [DEBUG] Not connected to session');
      this.snackBar.open('⚠️ Not connected to session', 'Close', { duration: 3000 });
      return;
    }

    try {
      const newSetting = !this.showLeaderboardAtEndOnly();
      console.log('📡 [DEBUG] New setting will be:', newSetting);
      
      // If enabling end-only, disable after-question mode
      if (newSetting) {
        console.log('🔧 [DEBUG] Disabling after-question mode');
        this.showLeaderboardAfterQuestion.set(false);
      }
      
      // Call backend to update setting
      console.log('📡 [DEBUG] Invoking SetShowLeaderboardAtEndOnly...');
      await this.hubConnection.invoke('SetShowLeaderboardAtEndOnly', this.sessionCode(), newSetting);
      console.log('✅ [DEBUG] Backend updated successfully');
      
      this.showLeaderboardAtEndOnly.set(newSetting);
      console.log('✅ [DEBUG] Local state updated to:', newSetting);
      
      const message = newSetting 
        ? '✅ Leaderboard will show only at quiz end' 
        : '🔒 End-only mode disabled';
      this.snackBar.open(message, 'Close', { duration: 3000 });
    } catch (error) {
      console.error('❌ [DEBUG] Toggle show at end only failed:', error);
      console.error('   - Error details:', JSON.stringify(error, null, 2));
      this.snackBar.open('⚠️ Failed to update setting', 'Close', { duration: 3000 });
    }
  }

  /**
   * Update leaderboard display duration
   */
  updateLeaderboardDuration(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    
    if (value >= 3 && value <= 30) {
      this.leaderboardDisplayDuration.set(value);
      console.log('⏱️ [DEBUG] Leaderboard display duration updated to:', value, 'seconds');
      this.snackBar.open(`⏱️ Display duration set to ${value} seconds`, 'Close', { duration: 2000 });
    } else {
      console.warn('⚠️ [DEBUG] Invalid duration:', value);
      input.value = this.leaderboardDisplayDuration().toString();
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
      
      // Show leaderboard at end if setting is enabled
      if (this.showLeaderboardAtEndOnly() && this.hubConnection && this.connectionStatus() === 'connected') {
        try {
          await this.hubConnection.invoke('ShowLeaderboardAtEnd', this.sessionCode());
          console.log('[HostLobby] Showing leaderboard at quiz end');
        } catch (error) {
          console.error('[HostLobby] Failed to show leaderboard at end:', error);
        }
      }
      
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
   * Disconnect from SignalR
   */
  private async disconnectSignalR() {
    if (this.hubConnection) {
      try {
        // Notify backend that host is leaving
        await this.hubConnection.invoke('LeaveHostSession', this.sessionCode());
        await this.hubConnection.stop();
        console.log('[HostLobby] SignalR disconnected - Session will switch to AUTO mode');
      } catch (error) {
        console.error('[HostLobby] Error disconnecting:', error);
      }
    }
  }
}
