import { Component, effect, inject, OnInit, OnDestroy, signal, computed, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { QuizListItem } from '../../models/quiz.models';
import { QuizPublishService } from '../../services/quiz-publish.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { Subscription } from 'rxjs';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';

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
  private subscriptions: Subscription[] = [];
  
  hostQuizzes = signal<QuizListItem[]>([]);
  quizAnalytics: { [key: number]: Analytics } = {};
  scheduledTimes: { [key: number]: string } = {};
  loading = signal(false);
  currentHostId = '2463579';

  // Tutorial properties
  private tutorialService = inject(TutorialService);
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'analytics-overview',
      title: '📊 Analytics Overview',
      description: 'View key metrics about your quizzes: total quizzes, questions, drafts, and published content.',
      targetElement: '.analytics-grid',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'quiz-list',
      title: '📋 Quiz Management',
      description: 'See all your quizzes here. You can view details, edit, publish, or schedule them from this list.',
      targetElement: '.quiz-list-section',
      position: 'left',
      skipable: true
    },
    {
      id: 'publish-actions',
      title: '🚀 Publishing Options',
      description: 'Use these buttons to publish quizzes, schedule them, or generate QR codes for easy participant access.',
      targetElement: '.publish-actions',
      position: 'top',
      skipable: true
    },
    {
      id: 'refresh-data',
      title: '🔄 Refresh Data',
      description: 'Click here to reload your quiz data and see the latest updates and analytics.',
      targetElement: '.btn-primary',
      position: 'left',
      skipable: true
    }
  ];

  analytics = computed(() => {
    const quizzes = this.hostQuizzes();
    const draftQuizzes = quizzes.filter(q => q.status === 'DRAFT' || q.status === 'draft');
    const publishedQuizzes = quizzes.filter(q => q.status === 'LIVE' || q.status === 'published');
    
    return {
      totalQuizzes: quizzes.length,
      draftQuizzes: draftQuizzes.length,
      publishedQuizzes: publishedQuizzes.length,
      totalQuestions: quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0),
      totalSurveys: 0, // Add survey counting logic when available
      totalPolls: 0, // Add poll counting logic when available
    };
  });

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
    if (this.showQRForQuizId() === quizId) {
      this.showQRForQuizId.set(null);
    } else {
      this.showQRForQuizId.set(quizId);
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
      const draftQuizzes = quizzes.filter(q => q.status === 'DRAFT' || q.status === 'draft').length;
      const publishedQuizzes = quizzes.filter(q => q.status === 'LIVE' || q.status === 'published').length;
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
    await this.loadQuizzes();
    this.initializeQuizPublishService();
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
      const quizzes = await this.store.getHostQuizzes(this.currentHostId);
      this.hostQuizzes.set(quizzes);
    } catch (error) {
      this.snackBar.open('Failed to load quizzes', 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
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

      // Check if quiz is already published
      if (quiz.status === 'LIVE') {
        this.snackBar.open('⚠️ Quiz is already published. Use Republish to update.', 'Close', {
          duration: 4000,
          panelClass: ['warning-snackbar'],
        });
        return;
      }

      const scheduledTime = this.scheduledTimes[quiz.quizId];

      await this.quizPublishService.publishQuiz(
        quiz.quizId,
        quizNumber,
        'HostUser',
        scheduledTime
      );

      this.snackBar.open(`✅ Quiz ${quizNumber} published successfully!`, 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });

      await this.loadQuizzes();
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

      await this.quizPublishService.unpublishQuiz(quizNumber);

      const scheduledTime = this.scheduledTimes[quiz.quizId];
      
      await this.quizPublishService.publishQuiz(
        quiz.quizId,
        quizNumber,
        'HostUser',
        scheduledTime
      );

      this.snackBar.open(`✅ Quiz ${quizNumber} republished successfully!`, 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });

      await this.loadQuizzes();
    } catch (error) {
      console.error('Error republishing quiz:', error);
      this.snackBar.open('⚠️ Failed to republish quiz', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  onScheduleTimeChange(quizId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    this.scheduledTimes[quizId] = input.value;
    console.log(`Schedule time for quiz ${quizId}:`, input.value);
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 1000);
  }

  // Tutorial methods
  startTutorial(): void {
    if (this.tutorialService.shouldAutoStart('results')) {
      console.log('Auto-starting tutorial for results component');
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'results');
    } else {
      console.log('Tutorial already seen for results component');
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial('results');
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'results');
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
  }
}
