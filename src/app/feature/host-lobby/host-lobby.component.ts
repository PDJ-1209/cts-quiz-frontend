import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
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
  mode = signal<'manual' | 'auto'>('manual');
  contentType = signal<'quiz' | 'survey' | 'poll'>('quiz'); // NEW: Content type detection
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
  private isProcessingTimerExpiry: boolean = false; // Prevent re-entry
  
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
  
  // NEW: Computed property to determine if leaderboard should be shown
  showLeaderboard = computed(() => this.contentType() === 'quiz');

  /**
   * Detect content type from session code format
   * Quiz: Quiz_NAME_DD_MM_YYYY_AXXXX
   * Survey: Survey_DD_MM_YYYY_SXXXX
   * Poll: Poll_DD_MM_YYYY_PXXXX
   */
  private detectContentTypeFromSessionCode(sessionCode: string): 'quiz' | 'survey' | 'poll' {
    if (!sessionCode) return 'quiz';
    
    const upperCode = sessionCode.toUpperCase();
    if (upperCode.startsWith('SURVEY_')) return 'survey';
    if (upperCode.startsWith('POLL_')) return 'poll';
    return 'quiz';
  }

  /**
   * Get display name for content type
   */
  getContentTypeDisplayName(): string {
    const type = this.contentType();
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  ngOnInit() {
    console.log('[HostLobby] Component initialized');
    // Get query parameters
    this.route.queryParams.subscribe(async params => {
      const code = params['sessionCode'] || '';
      const id = +params['quizId'] || +params['surveyId'] || +params['pollId'] || 0;
      const mode = params['mode'] === 'auto' ? 'auto' : 'manual';
      const typeParam = params['type'] || ''; // Get type from query param
      
      console.log('[HostLobby] Params:', { sessionCode: code, id, mode, type: typeParam });
      
      this.sessionCode.set(code);
      this.quizId.set(id);
      this.mode.set(mode);
      
      // Detect content type from session code if not provided in query param
      const detectedType = typeParam || this.detectContentTypeFromSessionCode(code);
      this.contentType.set(detectedType as 'quiz' | 'survey' | 'poll');
      console.log('[HostLobby] Content type detected:', this.contentType())
      
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
   * Start question timer with broadcast
   */
  private async startQuestionTimer() {
    console.log('[HostLobby] Starting question timer');
    
    // CRITICAL: Prevent duplicate timer creation
    if (this.questionTimerInterval) {
      console.log('⚠️ [HostLobby] Timer already running, clearing old one first');
      clearInterval(this.questionTimerInterval);
      this.questionTimerInterval = null;
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
        
        // Prevent multiple executions
        if (this.isProcessingTimerExpiry) {
          console.log('⚠️ [HostLobby] Already processing timer expiry, skipping...');
          return;
        }
        
        this.isProcessingTimerExpiry = true;
        
        console.log('⏰ [HostLobby] ========== QUESTION TIMER EXPIRED ==========');
        console.log('⏰ [HostLobby] Question ID:', timer.questionId);
        console.log('⏰ [HostLobby] ShowLeaderboardAfterQuestion setting:', this.showLeaderboardAfterQuestion());
        console.log('⏰ [HostLobby] Display duration:', this.leaderboardDisplayDuration());
        
        // STOP the timer interval immediately
        clearInterval(this.questionTimerInterval);
        this.questionTimerInterval = null;
        
        // Show leaderboard after question if setting is enabled
        if (this.showLeaderboardAfterQuestion()) {
          console.log('📊 [HostLobby] CALLING ShowLeaderboardAfterQuestion Hub method...');
          try {
            await this.hubConnection!.invoke('ShowLeaderboardAfterQuestion', 
              this.sessionCode(), 
              timer.questionId, 
              this.leaderboardDisplayDuration());
            console.log('✅ [HostLobby] ShowLeaderboardAfterQuestion invoked successfully');
            
            // WAIT for leaderboard display duration before advancing to next question
            const displayDuration = this.leaderboardDisplayDuration();
            console.log(`⏳ [HostLobby] Waiting ${displayDuration} seconds for leaderboard display...`);
            
            await new Promise(resolve => setTimeout(resolve, displayDuration * 1000));
            console.log('✅ [HostLobby] Leaderboard display completed, advancing to next question');
            
          } catch (error) {
            console.error('❌ [HostLobby] Failed to show leaderboard after question:', error);
          }
        } else {
          console.log('⚠️ [HostLobby] SKIPPING leaderboard - setting is disabled');
        }
        
        console.log('⏰ [HostLobby] ==================================================');
        
        // Now advance to next question AFTER leaderboard is done
        const nextQuestionNumber = this.currentQuestionNumber() + 1;
        if (nextQuestionNumber <= this.totalQuestions()) {
          console.log('[HostLobby] Auto-advancing to question', nextQuestionNumber);
          try {
            await this.forceNavigate(nextQuestionNumber);
          } catch (error) {
            console.error('[HostLobby] Auto-advance failed:', error);
            this.snackBar.open('⚠️ Connection issue, advancing locally', 'Close', { duration: 2000 });
          }
        } else {
          console.log('[HostLobby] Last question completed - ending quiz');
          await this.manualEndQuiz(true);
        }
        
        // Reset flag after processing complete
        this.isProcessingTimerExpiry = false;
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
      console.log('[HostLobby] Participant count updated:', count);
    });

    // NEW: Listen for participant join events (lobby sync)
    this.hubConnection.on('ParticipantJoined', (data: any) => {
      const participantName = data.ParticipantName || data.participantName || 'Someone';
      const totalParticipants = data.TotalParticipants || data.totalParticipants || 0;
      
      console.log('[HostLobby] Participant joined:', participantName, '- Total:', totalParticipants);
      
      // Show notification
      this.snackBar.open(`👤 ${participantName} joined! (${totalParticipants} total)`, 'Close', { duration: 3000 });
      
      // Update count
      const current = this.participantProgress();
      this.participantProgress.set({
        ...current,
        totalParticipants: totalParticipants
      });
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

    // NEW: Listen for survey started confirmation
    this.hubConnection.on('SurveyStarted', async (sessionCode: string) => {
      console.log('[HostLobby] SurveyStarted event received for:', sessionCode);
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      // Surveys typically don't have timers, but we can handle the first question
      if (this.currentQuestion()) {
        await this.startQuestionTimer();
      }
      console.log('[HostLobby] Survey started - waiting:', this.waitingForStart(), 'started:', this.quizStarted());
    });

    // NEW: Listen for poll started confirmation
    this.hubConnection.on('PollStarted', async (sessionCode: string) => {
      console.log('[HostLobby] PollStarted event received for:', sessionCode);
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      // Polls typically don't have timers, but handle the question if needed
      if (this.currentQuestion()) {
        await this.startQuestionTimer();
      }
      console.log('[HostLobby] Poll started - waiting:', this.waitingForStart(), 'started:', this.quizStarted());
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
      console.log('[HostLobby] Force starting content for session:', this.sessionCode());
      console.log('[HostLobby] Content type:', this.contentType());
      
      // Use unified content start method based on content type
      const contentType = this.contentType();
      await this.hubConnection.invoke('NotifyContentStart', this.sessionCode(), contentType);
      
      this.waitingForStart.set(false);
      this.quizStarted.set(true);
      
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      
      // Start the first question timer immediately after content starts
      if (this.currentQuestion()) {
        console.log('[HostLobby] Starting timer for first question');
        await this.startQuestionTimer();
      }
      
      const contentLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1);
      this.snackBar.open(`🚀 ${contentLabel} started! Participants can now begin.`, 'Close', { duration: 4000 });
      console.log('[HostLobby] Content started successfully');
    } catch (error) {
      console.error('[HostLobby] Force start failed:', error);
      this.snackBar.open('⚠️ Failed to start content', 'Close', { duration: 3000 });
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
        await this.hubConnection.stop();
        console.log('[HostLobby] SignalR disconnected');
      } catch (error) {
        console.error('[HostLobby] Error disconnecting:', error);
      }
    }
  }
}
