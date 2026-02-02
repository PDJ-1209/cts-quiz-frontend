import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AddQuestionService, QuizListItem } from '../../services/add-question.service';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface QuizAnalytics {
  totalQuizzes: number;
  totalQuestions: number;
  draftQuizzes: number;
  publishedQuizzes: number;
  categories: { [key: string]: number };
}

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, LoaderComponent, QrcodeComponent, MatSnackBarModule],
  templateUrl: './result.component.html',
  styleUrl: './result.component.css'
})
export class ResultComponent implements OnInit {
  private store = inject(AddQuestionService);
  private snackBar = inject(MatSnackBar);
  
  hostQuizzes = signal<QuizListItem[]>([]);
  analytics = signal<QuizAnalytics>({
    totalQuizzes: 0,
    totalQuestions: 0,
    draftQuizzes: 0,
    publishedQuizzes: 0,
    categories: {}
  });
  loading = signal(false);
  currentHostId = '2463579';
  showQRForQuizId = signal<number | null>(null);

  async ngOnInit() {
    await this.loadQuizzes();
  }

  async loadQuizzes() {
    this.loading.set(true);
    try {
      const quizzes = await this.store.getHostQuizzes(this.currentHostId);
      this.hostQuizzes.set(quizzes);
      this.calculateAnalytics(quizzes);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
      this.snackBar.open('⚠️ Failed to load quiz analytics.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      this.loading.set(false);
    }
  }

  private calculateAnalytics(quizzes: QuizListItem[]) {
    const categories: { [key: string]: number } = {};
    let totalQuestions = 0;
    let draftCount = 0;
    let publishedCount = 0;

    quizzes.forEach(quiz => {
      totalQuestions += quiz.questionCount;
      categories[quiz.category] = (categories[quiz.category] || 0) + 1;
      
      if (quiz.status.toLowerCase() === 'draft') {
        draftCount++;
      } else {
        publishedCount++;
      }
    });

    this.analytics.set({
      totalQuizzes: quizzes.length,
      totalQuestions,
      draftQuizzes: draftCount,
      publishedQuizzes: publishedCount,
      categories
    });
  }

  toggleQR(quizId: number) {
    if (this.showQRForQuizId() === quizId) {
      this.showQRForQuizId.set(null);
    } else {
      this.showQRForQuizId.set(quizId);
    }
  }

  getCategoryList(): { name: string; count: number }[] {
    const cats = this.analytics().categories;
    return Object.keys(cats).map(name => ({ name, count: cats[name] }));
  }
}
