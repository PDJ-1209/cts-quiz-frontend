import { Component, effect, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { QuizListItem } from '../../models/quiz.models';
import { QuizPublishService } from '../../services/quiz-publish.service';
import { Subscription } from 'rxjs';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';

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
export class ResultComponent implements OnInit, OnDestroy {
  private store = inject(QuizCreationService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private quizPublishService = inject(QuizPublishService);
  private subscriptions: Subscription[] = [];
  
  hostQuizzes = signal<QuizListItem[]>([]);
  quizAnalytics: { [key: number]: Analytics } = {};
  scheduledTimes: { [key: number]: string } = {};
  loading = signal(false);
  currentHostId = '2463579';

  analytics = computed(() => {
    const quizzes = this.hostQuizzes();
    return {
      totalQuizzes: quizzes.length,
      totalQuestions: quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0),
      draftQuizzes: quizzes.filter(q => q.status === 'DRAFT').length,
      publishedQuizzes: quizzes.filter(q => q.status === 'LIVE').length,
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
      this.hostQuizzes().forEach((quiz: QuizListItem) => {
        if (!this.quizAnalytics[quiz.quizId]) {
          this.quizAnalytics[quiz.quizId] = this.calculateAnalytics(quiz);
        }
      });
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

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.quizPublishService.disconnect();
  }
}
