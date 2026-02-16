import { Component, effect, inject, OnInit, OnDestroy, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { AuthService } from '../../services/auth.service';
import { QuizListItem } from '../../models/quiz.models';
import { QuizPublishService } from '../../services/quiz-publish.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { PollService } from '../../services/poll.service';
import { SurveyService } from '../../services/survey.service';
import { Subscription } from 'rxjs';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';
import { PollOverview } from '../../models/ipoll';
import { Survey, SurveyOverview } from '../../models/isurvey';

export interface Analytics {
  totalParticipants: number;
  averageScore: number;
  completionRate: number;
  topScore: number;
  worstScore: number;
  participantDetails: {
    participantName: string;
    score: number;
    timeTaken: string;
    completedAt: Date;
  }[];
}

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.css'],
  standalone: true,
  imports: [CommonModule, LoaderComponent, QrcodeComponent],
})
export class ResultComponent implements OnInit, OnDestroy, AfterViewInit {
  private store = inject(QuizCreationService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private quizPublishService = inject(QuizPublishService);
  private dashboardStatsService = inject(DashboardStatsService);
  private pollService = inject(PollService);
  private surveyService = inject(SurveyService);
  private authService = inject(AuthService);
  private subscriptions: Subscription[] = [];
  
  hostQuizzes = signal<QuizListItem[]>([]);
  hostPolls = signal<PollOverview[]>([]);
  hostSurveys = signal<SurveyOverview[]>([]);
  quizAnalytics: { [key: number]: Analytics } = {};
  startTimes: { [key: number]: string } = {};
  endTimes: { [key: number]: string } = {};
  pollStartTimes: { [key: number]: string } = {};
  pollEndTimes: { [key: number]: string } = {};
  surveyStartTimes: { [key: number]: string } = {};
  surveyEndTimes: { [key: number]: string } = {};
  loading = signal(false);
  currentHostId = computed(() => this.authService.currentUser()?.employeeId || '2463579');
  activeSessionIds: Map<string, number> = new Map(); // Map quiz number to session ID
  private statusCheckInterval: any;

  // Content type selection
  selectedContentType = signal<'quizzes' | 'surveys' | 'polls'>('quizzes');

  // Empty state messages
  emptyStateConfig = computed(() => {
    const type = this.selectedContentType();
    const configs = {
      quizzes: {
        icon: '📭',
        title: 'No Quizzes Found',
        message: 'Create your first quiz to get started.'
      },
      surveys: {
        icon: '📝',
        title: 'No Surveys Found',
        message: 'Create your first survey to collect feedback.'
      },
      polls: {
        icon: '🗳️',
        title: 'No Polls Found',
        message: 'Create your first poll to gather quick responses.'
      }
    };
    return configs[type];
  });

  // Tutorial properties
  private tutorialService = inject(TutorialService);
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'analytics-overview',
      title: '📊 Content Analytics',
      description: 'View key metrics about your content: total quizzes, surveys, polls, questions, and their status.',
      targetElement: '.analytics-grid',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'content-types',
      title: '📋 Content Types',
      description: 'Switch between different content types to manage your quizzes, surveys, and polls separately.',
      targetElement: '.btn-group',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'quiz-list',
      title: '📝 Content Management',
      description: 'View, edit, publish, or schedule your content. Each item shows status, participant count, and available actions.',
      targetElement: '.table-responsive',
      position: 'left',
      skipable: true
    },
    {
      id: 'publish-actions',
      title: '🚀 Publishing Options',
      description: 'Use these buttons to publish content, schedule them, or generate QR codes for easy participant access.',
      targetElement: '.publish-btn',
      position: 'top',
      skipable: true
    },
    {
      id: 'refresh-data',
      title: '🔄 Refresh Data',
      description: 'Click here to reload your content data and see the latest updates and analytics.',
      targetElement: '.btn-primary',
      position: 'left',
      skipable: true
    }
  ];

  analytics = computed(() => {
    const quizzes = this.hostQuizzes();
    const polls = this.hostPolls();
    const surveys = this.hostSurveys();
    
    const draftQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'draft');
    const activeQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'active');
    const completedQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'completed');
    
    return {
      totalQuizzes: quizzes.length,
      draftQuizzes: draftQuizzes.length,
      publishedQuizzes: activeQuizzes.length + completedQuizzes.length,
      totalQuestions: quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0),
      totalSurveys: surveys.length,
      totalPolls: polls.length,
    };
  });

  pageTitle = computed(() => {
    const currentUrl = this.router.url;
    return currentUrl.includes('/host/manage-content') 
      ? '🔧 Content Management Dashboard'
      : '📊 Quiz Analytics Dashboard';
  });

  debugInfo = computed(() => ({
    selectedType: this.selectedContentType(),
    quizCount: this.hostQuizzes().length,
    surveyCount: this.hostSurveys().length,
    pollCount: this.hostPolls().length,
    hasQuizzes: this.hostQuizzes().length > 0,
    hasSurveys: this.hostSurveys().length > 0,
    hasPolls: this.hostPolls().length > 0
  }));

  getCategoryList = computed(() => {
    const categoryMap = new Map<string, number>();
    this.hostQuizzes().forEach(quiz => {
      if (quiz.category) {
        categoryMap.set(quiz.category, (categoryMap.get(quiz.category) || 0) + 1);
      }
    });
    return Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
  });

  showQRForQuizId = signal<number | null>(null);

  toggleQR(quizId: number) {
    console.log('Toggle QR called for ID:', quizId);
    console.log('Current showQRForQuizId:', this.showQRForQuizId());
    
    // Find the item to get more context
    const poll = this.hostPolls().find(p => p.pollId === quizId);
    const survey = this.hostSurveys().find(s => s.surveyId === quizId);
    const quiz = this.hostQuizzes().find(q => q.quizId === quizId);
    
    if (poll) {
      console.log('Poll found:', { pollId: poll.pollId, sessionCode: poll.sessionCode, status: poll.pollStatus });
    } else if (survey) {
      console.log('Survey found:', { surveyId: survey.surveyId, sessionCode: survey.sessionCode, status: survey.status });
    } else if (quiz) {
      console.log('Quiz found:', { quizId: quiz.quizId, quizNumber: quiz.quizNumber });
    }
    
    if (this.showQRForQuizId() === quizId) {
      this.showQRForQuizId.set(null);
      console.log('Hiding QR');
    } else {
      this.showQRForQuizId.set(quizId);
      console.log('Showing QR for ID:', quizId);
    }
  }

  selectContentType(type: 'quizzes' | 'surveys' | 'polls') {
    this.selectedContentType.set(type);
  }

  async loadAllContent() {
    this.loading.set(true);
    try {
      await this.loadQuizzes();
      await this.loadSurveys(); 
      await this.loadPolls();
    } finally {
      this.loading.set(false);
    }
  }

  constructor() {
    effect(() => {
      const quizzes = this.hostQuizzes();
      
      // Calculate analytics
      quizzes.forEach((quiz: QuizListItem) => {
        if (!this.quizAnalytics[quiz.quizId]) {
          this.quizAnalytics[quiz.quizId] = this.calculateAnalytics(quiz);
        }
      });

      // Update shared dashboard stats
      const draftQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'draft').length;
      const activeQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'active').length;
      const completedQuizzes = quizzes.filter(q => q.status?.toLowerCase() === 'completed').length;
      const publishedQuizzes = activeQuizzes + completedQuizzes;
      const totalQuestions = quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0);

      this.dashboardStatsService.updateQuizStats(
        quizzes.length,
        draftQuizzes,
        publishedQuizzes,
        totalQuestions
      );
    });
  }

  async ngOnInit() {
    console.log('ResultComponent ngOnInit - Loading all content...');
    await this.loadQuizzes();
    await this.loadSurveys();
    await this.loadPolls();
    this.initializeQuizPublishService();
    this.startStatusPolling();
    
    console.log('Loaded data summary:');
    console.log('- Quizzes:', this.hostQuizzes().length);
    console.log('- Surveys:', this.hostSurveys().length); 
    console.log('- Polls:', this.hostPolls().length);
  }

  private startStatusPolling() {
    console.log('[StatusPolling] Starting status check every 10 seconds');
    // Check session statuses every 10 seconds for faster updates
    this.statusCheckInterval = setInterval(async () => {
      await this.checkActiveSessions();
    }, 10000); // 10 seconds
  }

  private async checkActiveSessions() {
    // Skip if no active sessions to check
    if (this.activeSessionIds.size === 0) {
      return;
    }

    console.log('[StatusPolling] Checking active sessions. Count:', this.activeSessionIds.size);

    let statusChanged = false;

    for (const [quizNumber, sessionId] of this.activeSessionIds.entries()) {
      console.log(`[StatusPolling] Checking session for quiz ${quizNumber} (SessionId: ${sessionId})`);
      try {
        const session = await this.quizPublishService.getQuizSessionByCode(quizNumber);
        
        // Update the time inputs with session times (for display when Active)
        const quiz = this.hostQuizzes().find(q => q.quizNumber === quizNumber);
        if (quiz && session) {
          // Convert ISO datetime to datetime-local format (YYYY-MM-DDTHH:mm)
          if (session.startedAt) {
            const startDate = new Date(session.startedAt);
            this.startTimes[quiz.quizId] = this.formatDateTimeLocal(startDate);
          }
          if (session.endedAt) {
            const endDate = new Date(session.endedAt);
            this.endTimes[quiz.quizId] = this.formatDateTimeLocal(endDate);
          }
        }
        
        // Check current quiz status in our list
        const currentQuiz = this.hostQuizzes().find(q => q.quizNumber === quizNumber);
        const currentStatus = currentQuiz?.status?.toLowerCase();
        const newStatus = session?.status?.toLowerCase();

        // If status changed, mark for refresh
        if (newStatus && currentStatus !== newStatus) {
          console.log(`Status changed for ${quizNumber}: ${currentStatus} -> ${newStatus}`);
          statusChanged = true;
        }

        // If status changed to Completed, remove from tracking
        if (session?.status?.toLowerCase() === 'completed') {
          this.activeSessionIds.delete(quizNumber);
          
          this.snackBar.open(
            `🏁 Quiz ${quizNumber} has been automatically completed`,
            'Close',
            { duration: 5000, panelClass: ['info-snackbar'] }
          );
        }
      } catch (error: any) {
        // If 404, session might have been deleted or never created - remove from tracking
        if (error.status === 404) {
          console.log(`Session ${quizNumber} not found (404) - quiz may have been reset to Draft`);
          this.activeSessionIds.delete(quizNumber);
          
          // Sync the quiz status back to Draft in the database
          const quiz = this.hostQuizzes().find(q => q.quizNumber === quizNumber);
          if (quiz) {
            try {
              await this.store.syncQuizStatus(quiz.quizId);
              console.log(`Successfully synced Quiz ${quiz.quizId} back to Draft status`);
              
              // Clear the time inputs for this quiz
              delete this.startTimes[quiz.quizId];
              delete this.endTimes[quiz.quizId];
              
              this.snackBar.open(
                `🔄 Quiz ${quizNumber} reset to Draft - session deleted`,
                'Close',
                { duration: 4000, panelClass: ['info-snackbar'] }
              );
            } catch (syncError) {
              console.error('Error syncing quiz status:', syncError);
            }
          }
          
          statusChanged = true; // Force reload to sync UI with database
        } else {
          console.error(`Error checking status for session ${quizNumber}:`, error);
        }
      }
    }

    // Reload quizzes if any status changed
    if (statusChanged) {
      console.log('Status changed detected - reloading quiz list');
      await this.loadQuizzes();
    }
  }

  private initializeQuizPublishService() {
    const connectionSub = this.quizPublishService.connectionState$.subscribe(state => {
      console.log('SignalR Connection State:', state);
    });
    
    const quizPublishedSub = this.quizPublishService.quizPublished$.subscribe(data => {
      if (data) {
        this.snackBar.open(
          `📢 Quiz ${data.quizNumber} is now LIVE!`,
          'Close',
          { duration: 5000 }
        );
      }
    });

    this.subscriptions.push(connectionSub, quizPublishedSub);
  }

  async loadQuizzes() {
    try {
      this.loading.set(true);
      const quizzes = await this.store.getHostQuizzes(this.currentHostId());
      
      console.log('Loaded quizzes:', quizzes.map(q => ({
        id: q.quizId,
        number: q.quizNumber,
        name: q.quizName,
        status: q.status
      })));
      
      this.hostQuizzes.set(quizzes);
      
      // Load session times for active/completed quizzes and verify session exists
      for (const quiz of quizzes) {
        const status = quiz.status?.toLowerCase();
        
        if (status === 'active' || status === 'completed') {
          try {
            const session = await this.quizPublishService.getQuizSessionByCode(quiz.quizNumber);
            if (session) {
              // Store session times in datetime-local format
              if (session.startedAt) {
                const startDate = new Date(session.startedAt);
                this.startTimes[quiz.quizId] = this.formatDateTimeLocal(startDate);
              }
              if (session.endedAt) {
                const endDate = new Date(session.endedAt);
                this.endTimes[quiz.quizId] = this.formatDateTimeLocal(endDate);
              }
              // Track active sessions only
              if (status === 'active' && session.sessionId) {
                this.activeSessionIds.set(quiz.quizNumber, session.sessionId);
              }
            }
          } catch (error: any) {
            // If 404, session was deleted but quiz still marked Active/Completed - sync it back to Draft
            if (error.status === 404) {
              console.log(`Quiz ${quiz.quizNumber} is ${status.toUpperCase()} but no session exists - syncing to Draft`);
              try {
                await this.store.syncQuizStatus(quiz.quizId);
                // Clear time inputs
                delete this.startTimes[quiz.quizId];
                delete this.endTimes[quiz.quizId];
                
                this.snackBar.open(
                  `🔄 Quiz ${quiz.quizNumber} reset to Draft - session was deleted`,
                  'Close',
                  { duration: 4000, panelClass: ['info-snackbar'] }
                );
                
                // Reload to reflect changes
                setTimeout(async () => {
                  await this.loadQuizzes();
                }, 500);
                return; // Exit to avoid further processing
              } catch (syncError) {
                console.error('Error syncing quiz status on load:', syncError);
              }
            } else {
              console.error(`Error loading session for ${status} quiz ${quiz.quizNumber}:`, error);
            }
          }
        }
      }
      
      // Clean up active sessions map - remove completed or draft quizzes
      for (const [quizNumber] of this.activeSessionIds.entries()) {
        const quiz = quizzes.find(q => q.quizNumber === quizNumber);
        if (!quiz || quiz.status?.toLowerCase() !== 'active') {
          console.log(`Removing ${quizNumber} from active tracking (status: ${quiz?.status})`);
          this.activeSessionIds.delete(quizNumber);
        }
      }
      
      // DO NOT auto-add active quizzes - only track sessions we explicitly created
      // This prevents checking for sessions that might not exist in QuizSession table
    } catch (error) {
      this.snackBar.open('Failed to load quizzes', 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async loadSurveys() {
    try {
      const surveys = await new Promise<SurveyOverview[]>((resolve, reject) => {
        this.surveyService.getAllSurveysV2().subscribe({
          next: (data) => resolve(data || []),
          error: (error) => reject(error)
        });
      });
      this.hostSurveys.set(surveys);
      console.log('Loaded surveys:', surveys?.length || 0, 'surveys');
      console.log('Survey session codes:', surveys.map(s => ({ id: s.surveyId, code: s.sessionCode, status: s.status })));
    } catch (error) {
      console.error('Failed to load surveys:', error);
      this.hostSurveys.set([]);
    }
  }

  async loadPolls() {
    try {
      const polls = await new Promise<PollOverview[]>((resolve, reject) => {
        this.pollService.getAllPolls().subscribe({
          next: (data) => resolve(data || []),
          error: (error) => reject(error)
        });
      });
      this.hostPolls.set(polls);
      console.log('Loaded polls:', polls?.length || 0, 'polls');
      console.log('Poll session codes:', polls.map(p => ({ id: p.pollId, code: p.sessionCode, status: p.pollStatus })));
    } catch (error) {
      console.error('Failed to load polls:', error);
      this.hostPolls.set([]);
    }
  }

  viewResults(quizId: number) {
    this.router.navigate(['/quiz', quizId, 'results']);
  }

  editQuiz(quizId: number) {
    this.router.navigate(['/quiz', quizId, 'edit']);
  }

  async deleteQuiz(quizId: number) {
    const confirmed = confirm('Are you sure you want to delete this quiz?');
    if (confirmed) {
      try {
        await this.store.deleteQuiz(quizId);
        delete this.quizAnalytics[quizId];
        this.snackBar.open('Quiz deleted successfully', 'Close', { duration: 3000 });
      } catch (error) {
        this.snackBar.open('Failed to delete quiz', 'Close', { duration: 3000 });
      }
    }
  }

  private calculateAnalytics(quiz: QuizListItem): Analytics {
    const participants: any[] = (quiz as any).participants || [];
    const totalParticipants = participants.length;
    
    if (totalParticipants === 0) {
      return {
        totalParticipants: 0,
        averageScore: 0,
        completionRate: 0,
        topScore: 0,
        worstScore: 0,
        participantDetails: [],
      };
    }

    const scores = participants.map((p: any) => p.score || 0);
    const averageScore = scores.reduce((a: number, b: number) => a + b, 0) / totalParticipants;
    const topScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const completedCount = participants.filter((p: any) => p.completedAt).length;
    const completionRate = (completedCount / totalParticipants) * 100;

    return {
      totalParticipants,
      averageScore: Math.round(averageScore * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      topScore,
      worstScore,
      participantDetails: participants.map((p: any) => ({
        participantName: p.name,
        score: p.score || 0,
        timeTaken: p.timeTaken || 'N/A',
        completedAt: p.completedAt || new Date(),
      })),
    };
  }

  async publishQuiz(quizNumber: string) {
    try {
      const quiz = this.hostQuizzes().find((q: QuizListItem) => q.quizNumber === quizNumber);
      
      if (!quiz) {
        this.snackBar.open('⚠️ Quiz not found', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        return;
      }

      const startTimeInput = this.startTimes[quiz.quizId];
      const endTimeInput = this.endTimes[quiz.quizId];

      // Validate that both start and end times are provided
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      if (!endTimeInput) {
        this.snackBar.open('⚠️ End time is required', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      // Convert datetime-local format to ISO string
      let startTime: string | undefined;
      let endTime: string | undefined;

      if (startTimeInput) {
        startTime = new Date(startTimeInput).toISOString();
      }

      if (endTimeInput) {
        const endDate = new Date(endTimeInput);
        endTime = endDate.toISOString();
        
        // Validate end time is in the future
        const now = new Date();
        if (endDate <= now) {
          this.snackBar.open('⚠️ End time must be in the future', 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar'],
          });
          return;
        }

        // Validate end time is after start time
        const startDate = new Date(startTimeInput);
        if (endDate <= startDate) {
          this.snackBar.open('⚠️ End time must be after start time', 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar'],
          });
          return;
        }
      }

      console.log('Publishing quiz:', {
        quizId: quiz.quizId,
        quizNumber,
        quizName: quiz.quizName,
        currentStatus: quiz.status,
        startTimeInput,
        startTimeISO: startTime,
        endTimeInput,
        endTimeISO: endTime,
        currentTime: new Date().toISOString(),
        currentTimeLocal: new Date().toString()
      });

      console.log(`[PublishQuiz] Calling createQuizSession for QuizId=${quiz.quizId}, QuizNumber=${quizNumber}`);

      // Create QuizSession using the new method designed for SignalR
      const sessionResponse = await this.quizPublishService.createQuizSession(
        quiz.quizId,
        this.currentHostId(),
        quizNumber,
        startTime,
        endTime,
        'Active'
      );

      console.log(`[PublishQuiz] Session created successfully:`, sessionResponse);

      // Track this session for status monitoring
      this.activeSessionIds.set(quizNumber, sessionResponse.sessionId);

      console.log('Session created:', sessionResponse);

      this.snackBar.open(
        `✅ Quiz ${quizNumber} published! Status: ${sessionResponse.status}`,
        'Close',
        {
          duration: 5000,
          panelClass: ['success-snackbar'],
        }
      );

      // Reload quizzes immediately to reflect status change
      await this.loadQuizzes();
      
      // Reload again after 2 seconds to ensure database sync
      setTimeout(async () => {
        console.log('Secondary reload to ensure database sync');
        await this.loadQuizzes();
      }, 2000);
    } catch (error: any) {
      console.error('Error publishing quiz:', error);
      
      // Extract backend error message
      let errorMessage = 'Failed to publish quiz';
      if (error.status === 500) {
        errorMessage = error.error?.message || error.error?.title || 'Server error - check backend logs';
      } else if (error.status === 409) {
        errorMessage = 'Quiz already published or session conflict';
      } else if (error.status === 400) {
        errorMessage = error.error?.message || 'Invalid quiz data';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to backend server. Please start the backend.';
      }
      
      this.snackBar.open(`⚠️ ${errorMessage}`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  async republishQuiz(quizNumber: string) {
    try {
      const quiz = this.hostQuizzes().find((q: QuizListItem) => q.quizNumber === quizNumber);
      
      if (!quiz) {
        this.snackBar.open('⚠️ Quiz not found', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        return;
      }

      // Get start and end times from inputs
      const startTimeInput = this.startTimes[quiz.quizId];
      const endTimeInput = this.endTimes[quiz.quizId];

      // Validate that both start and end times are provided
      if (!startTimeInput) {
        this.snackBar.open('⚠️ Start time is required', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      if (!endTimeInput) {
        this.snackBar.open('⚠️ End time is required', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      // Convert datetime-local format to ISO string
      let startTime: string | undefined;
      let endTime: string | undefined;

      if (startTimeInput) {
        startTime = new Date(startTimeInput).toISOString();
      }

      if (endTimeInput) {
        const endDate = new Date(endTimeInput);
        endTime = endDate.toISOString();
        
        // Validate end time is in the future
        const now = new Date();
        if (endDate <= now) {
          this.snackBar.open('⚠️ End time must be in the future', 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar'],
          });
          return;
        }

        // Validate end time is after start time
        const startDate = new Date(startTimeInput);
        if (endDate <= startDate) {
          this.snackBar.open('⚠️ End time must be after start time', 'Close', {
            duration: 4000,
            panelClass: ['warning-snackbar'],
          });
          return;
        }
      }

      console.log('Republishing quiz:', {
        quizId: quiz.quizId,
        quizNumber,
        startTimeISO: startTime,
        endTimeISO: endTime
      });

      // First, mark the old completed session (if any) - backend will create new one
      // Create a new QuizSession with Active status
      const sessionResponse = await this.quizPublishService.createQuizSession(
        quiz.quizId,
        this.currentHostId(),
        quizNumber,
        startTime,
        endTime,
        'Active'  // New session starts as Active
      );

      console.log('New session created for republish:', sessionResponse);

      // Now reset the quiz back to Draft status
      try {
        await this.store.syncQuizStatus(quiz.quizId);
        console.log(`Quiz ${quiz.quizId} reset to Draft after creating new session`);
      } catch (error) {
        console.error('Error resetting quiz to Draft:', error);
      }

      // Track this session for status monitoring
      this.activeSessionIds.set(quizNumber, sessionResponse.sessionId);

      this.snackBar.open(
        `✅ New session created for Quiz ${quizNumber}! Quiz reset to Draft.`,
        'Close',
        {
          duration: 5000,
          panelClass: ['success-snackbar'],
        }
      );

      // Reload quizzes immediately to reflect status change
      await this.loadQuizzes();
      
      // Reload again after 2 seconds to ensure database sync
      setTimeout(async () => {
        console.log('Secondary reload after republish');
        await this.loadQuizzes();
      }, 2000);
    } catch (error: any) {
      console.error('Error republishing quiz:', error);
      
      let errorMessage = 'Failed to republish quiz';
      if (error.status === 500) {
        errorMessage = error.error?.message || 'Server error - check backend logs';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to backend server';
      }
      
      this.snackBar.open(`⚠️ ${errorMessage}`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  // Publish Poll with Session Creation
  async publishPoll(pollId: number) {
    try {
      const poll = this.hostPolls().find(p => p.pollId === pollId);
      
      if (!poll) {
        this.snackBar.open('⚠️ Poll not found', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        return;
      }

      const startTimeInput = this.pollStartTimes[pollId];
      const endTimeInput = this.pollEndTimes[pollId];

      if (!startTimeInput || !endTimeInput) {
        this.snackBar.open('⚠️ Please set both start and end times', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      const startDate = new Date(startTimeInput);
      const endDate = new Date(endTimeInput);
      const now = new Date();

      if (endDate <= now) {
        this.snackBar.open('⚠️ End time must be in the future', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      if (endDate <= startDate) {
        this.snackBar.open('⚠️ End time must be after start time', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      // Determine if this is scheduled (future) or immediate publish
      const isScheduled = startDate > now;
      
      let publishResponse: any;

      if (isScheduled) {
        // Use SchedulePoll for future times
        console.log('Scheduling poll for future time:', startDate);
        publishResponse = await this.pollService.schedulePoll(
          pollId,
          startDate,
          endDate,
          45 // countdown duration in seconds
        ).toPromise();
        
        this.snackBar.open(`✅ Poll scheduled for ${startDate.toLocaleString()}`, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar'],
        });
      } else {
        // Use PublishPoll for immediate start
        console.log('Publishing poll immediately');
        const publishPayload = {
          pollId: pollId,
          hostId: this.currentHostId(),
          startedAt: startDate.toISOString(),
          endedAt: endDate.toISOString()
        };
        
        publishResponse = await this.pollService.publishPoll(publishPayload).toPromise();
        
        this.snackBar.open(`✅ Poll published successfully!`, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar'],
        });
      }

      console.log('Poll publish/schedule response:', publishResponse);

      // Update the poll with session code immediately
      const pollIndex = this.hostPolls().findIndex(p => p.pollId === pollId);
      if (pollIndex !== -1 && publishResponse?.sessionCode) {
        const updatedPolls = [...this.hostPolls()];
        updatedPolls[pollIndex] = {
          ...updatedPolls[pollIndex],
          pollStatus: publishResponse.pollStatus || publishResponse.status || (isScheduled ? 'Scheduled' : 'Active'),
          sessionCode: publishResponse.sessionCode
        };
        this.hostPolls.set(updatedPolls);
      }

    } catch (error: any) {
      console.error('Error publishing/scheduling poll:', error);
      
      let errorMessage = 'Failed to publish poll';
      if (error.status === 500) {
        errorMessage = error.error?.message || 'Server error';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to backend server';
      }
      
      this.snackBar.open(`⚠️ ${errorMessage}`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  // Publish Survey with Session Creation
  async publishSurvey(surveyId: number) {
    try {
      const survey = this.hostSurveys().find(s => s.surveyId === surveyId);
      
      if (!survey) {
        this.snackBar.open('⚠️ Survey not found', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        return;
      }

      const startTimeInput = this.surveyStartTimes[surveyId];
      const endTimeInput = this.surveyEndTimes[surveyId];

      if (!startTimeInput || !endTimeInput) {
        this.snackBar.open('⚠️ Please set both start and end times', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      const startDate = new Date(startTimeInput);
      const endDate = new Date(endTimeInput);
      const now = new Date();

      if (endDate <= now) {
        this.snackBar.open('⚠️ End time must be in the future', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      if (endDate <= startDate) {
        this.snackBar.open('⚠️ End time must be after start time', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      // Determine if this is scheduled (future) or immediate publish
      const isScheduled = startDate > now;
      
      let publishResponse: any;

      if (isScheduled) {
        // Use ScheduleSurvey for future times
        console.log('Scheduling survey for future time:', startDate);
        publishResponse = await this.surveyService.scheduleSurvey(
          surveyId,
          startDate,
          endDate,
          45 // countdown duration in seconds
        ).toPromise();
        
        this.snackBar.open(`✅ Survey scheduled for ${startDate.toLocaleString()}`, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar'],
        });
      } else {
        // Use PublishSurvey for immediate start
        console.log('Publishing survey immediately');
        const publishPayload = {
          surveyId: surveyId,
          hostId: this.currentHostId(),
          startedAt: startDate.toISOString(),
          endedAt: endDate.toISOString()
        };
        
        publishResponse = await this.surveyService.publishSurvey(publishPayload).toPromise();
        
        this.snackBar.open(`✅ Survey published successfully!`, 'Close', {
          duration: 5000,
          panelClass: ['success-snackbar'],
        });
      }

      console.log('Survey publish/schedule response:', publishResponse);

      // Update the survey with session code immediately
      const surveyIndex = this.hostSurveys().findIndex(s => s.surveyId === surveyId);
      if (surveyIndex !== -1 && publishResponse?.sessionCode) {
        const updatedSurveys = [...this.hostSurveys()];
        updatedSurveys[surveyIndex] = {
          ...updatedSurveys[surveyIndex],
          status: publishResponse.status || (isScheduled ? 'Scheduled' : 'Active'),
          sessionCode: publishResponse.sessionCode
        };
        this.hostSurveys.set(updatedSurveys);
      }

    } catch (error: any) {
      console.error('Error publishing/scheduling survey:', error);
      
      let errorMessage = 'Failed to publish survey';
      if (error.status === 500) {
        errorMessage = error.error?.message || 'Server error';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to backend server';
      }
      
      this.snackBar.open(`⚠️ ${errorMessage}`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  private generateSessionCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  onStartTimeChange(quizId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.startTimes![quizId] = input.value;
    console.log(`Start time for quiz ${quizId}:`, input.value);
    
    // Convert to ISO string for backend
    if (input.value) {
      const date = new Date(input.value);
      console.log(`Converted start time:`, date.toISOString(), `Local:`, date.toString());
    }
  }

  onEndTimeChange(quizId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.endTimes[quizId] = input.value;
    console.log(`End time for quiz ${quizId}:`, input.value);
    
    // Convert to ISO string for backend
    if (input.value) {
      const date = new Date(input.value);
      console.log(`Converted end time:`, date.toISOString(), `Local:`, date.toString());
    }
  }

  // Poll time handlers
  onPollStartTimeChange(pollId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.pollStartTimes[pollId] = input.value;
    console.log(`Start time for poll ${pollId}:`, input.value);
  }

  onPollEndTimeChange(pollId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.pollEndTimes[pollId] = input.value;
    console.log(`End time for poll ${pollId}:`, input.value);
  }

  // Survey time handlers
  onSurveyStartTimeChange(surveyId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.surveyStartTimes[surveyId] = input.value;
    console.log(`Start time for survey ${surveyId}:`, input.value);
  }

  onSurveyEndTimeChange(surveyId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.surveyEndTimes[surveyId] = input.value;
    console.log(`End time for survey ${surveyId}:`, input.value);
  }

  /**
   * Format Date object to datetime-local input format (YYYY-MM-DDTHH:mm)
   */
  private formatDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Format Date to display format (for UI display)
   */
  formatDateTime(date: Date | string | undefined | null): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 1000);
  }

  // Tutorial methods
  startTutorial(): void {
    const componentName = this.getComponentContext();
    if (this.tutorialService.shouldAutoStart(componentName)) {
      console.log(`Auto-starting tutorial for ${componentName} component`);
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, componentName);
    } else {
      console.log(`Tutorial already seen for ${componentName} component`);
    }
  }

  resetTutorial(): void {
    const componentName = this.getComponentContext();
    this.tutorialService.resetTutorial(componentName);
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, componentName);
  }

  private getComponentContext(): string {
    // Determine the context based on the current route
    const currentUrl = this.router.url;
    if (currentUrl.includes('/host/manage-content')) {
      return 'manage-content';
    }
    return 'results';
  }

  nextTutorialStep(): void {
    this.tutorialService.nextStep();
  }

  previousTutorialStep(): void {
    this.tutorialService.previousStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }

  getCurrentStep(): TutorialStep | null {
    return this.tutorialService.getCurrentStepData();
  }

  getSpotlightPosition(): { top: string; left: string; width: string; height: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
  }

  getPopupPosition(): { top: string; left: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const popupWidth = 350;
    const popupHeight = 200;

    let top = rect.top;
    let left = rect.left;

    switch (currentStep.position) {
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'top':
        top = rect.top - popupHeight - 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.left - popupWidth - 10;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.right + 10;
        break;
    }

    // Ensure popup stays within viewport
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (top < 10) top = 10;
    if (top + popupHeight > window.innerHeight - 10) top = window.innerHeight - popupHeight - 10;

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.quizPublishService.disconnect();
    
    // Clear status polling interval
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }
}
