import { Component, inject, computed, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AddQuestionService, QuizQuestion, QuizListItem } from '../../services/add-question.service';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-preview',
  imports: [CommonModule, FormsModule, LoaderComponent, QrcodeComponent, MatSnackBarModule],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.css'
})
export class PreviewComponent {
  private store = inject(AddQuestionService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  
  @Output() switchToQuestionsTab = new EventEmitter<void>();
  
  quizMeta = computed(() => this.store.quizMeta());
  questions = computed(() => this.store.questions());
  
  editingQuestionIndex = signal<number | null>(null);
  editingQuestion = signal<QuizQuestion | null>(null);
  
  // New properties for managing existing quizzes
  hostQuizzes = signal<QuizListItem[]>([]);
  showQuizList = signal(true);
  loadingQuizzes = signal(false);
  currentHostName = '2463579'; // Current logged in host ID
  showQRForQuizId = signal<number | null>(null);

  constructor() {
    this.loadHostQuizzes();
  }

  async loadHostQuizzes(): Promise<void> {
    this.loadingQuizzes.set(true);
    try {
      const quizzes = await this.store.getHostQuizzes(this.currentHostName);
      this.hostQuizzes.set(quizzes);
    } catch (error) {
      console.error('Failed to load host quizzes:', error);
      this.snackBar.open('⚠️ Failed to load your quizzes.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } finally {
      this.loadingQuizzes.set(false);
    }
  }

  async loadQuizForEditing(quizId: number): Promise<void> {
    try {
      const quizDetails = await this.store.getQuizForEdit(quizId);
      this.store.loadQuizForEditing(quizDetails);
      this.showQuizList.set(false);
      this.cancelEdit(); // Close any ongoing edits
    } catch (error) {
      console.error('Failed to load quiz for editing:', error);
      this.snackBar.open('⚠️ Failed to load quiz for editing.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  startNewQuiz(): void {
    this.store.clearAll();
    this.cancelEdit();
    this.switchToQuestionsTab.emit();
  }

  backToQuizList(): void {
    this.showQuizList.set(true);
    this.cancelEdit();
    this.loadHostQuizzes(); // Refresh the list
  }

  startEditQuestion(index: number): void {
    const question = this.questions()[index];
    this.editingQuestionIndex.set(index);
    // Create a deep copy for editing
    this.editingQuestion.set({
      ...question,
      options: question.options.map(opt => ({ ...opt }))
    });
  }

  cancelEdit(): void {
    this.editingQuestionIndex.set(null);
    this.editingQuestion.set(null);
  }

  saveQuestion(): void {
    const index = this.editingQuestionIndex();
    const editedQuestion = this.editingQuestion();
    
    if (index !== null && editedQuestion) {
      this.store.updateQuestion(index, editedQuestion);
      this.cancelEdit();
    }
  }

  deleteQuestion(index: number): void {
    const snackBarRef = this.snackBar.open(`Delete question #${index + 1}?`, 'Delete', {
      duration: 0,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    
    snackBarRef.onAction().subscribe(() => {
      this.store.removeQuestion(index);
      this.cancelEdit();
    });
  }

  addOption(): void {
    const question = this.editingQuestion();
    if (question) {
      question.options.push({ text: '', isCorrect: false });
      this.editingQuestion.set({ ...question });
    }
  }

  removeOption(optionIndex: number): void {
    const question = this.editingQuestion();
    if (question && question.options.length > 1) {
      question.options.splice(optionIndex, 1);
      this.editingQuestion.set({ ...question });
    }
  }

  setCorrectOption(optionIndex: number): void {
    const question = this.editingQuestion();
    if (question) {
      question.options.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
      });
      this.editingQuestion.set({ ...question });
    }
  }

  async createQuiz(): Promise<void> {
    const meta = this.quizMeta();
    const questions = this.questions();
    
    if (!meta || questions.length === 0) {
      this.snackBar.open('⚠️ Please add quiz details and at least one question.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const snackBarRef = this.snackBar.open(
      `Create Quiz: "${meta.quizName}" | Category: ${meta.category} | Questions: ${questions.length}`,
      'Confirm',
      {
        duration: 0,
        panelClass: ['confirm-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      }
    );
    
    const confirmed = await new Promise<boolean>((resolve) => {
      snackBarRef.onAction().subscribe(() => resolve(true));
      snackBarRef.afterDismissed().subscribe(() => resolve(false));
    });
    
    if (!confirmed) {
      return;
    }

    try {
      const res = await this.store.createQuiz();
      this.snackBar.open(
        `✅ Quiz Created Successfully! | Quiz Number: ${res.quizNumber} | Quiz ID: ${res.quizId} | Questions: ${res.questionCount}`,
        'Close',
        {
          duration: 8000,
          panelClass: ['success-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
      
      // Clear everything after successful creation
      this.store.clearAll();
      this.cancelEdit();
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(
        `❌ Failed to create quiz: ${err?.message ?? 'Unknown error'}`,
        'Close',
        {
          duration: 6000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
    }
  }

  toggleQR(quizId: number): void {
    if (this.showQRForQuizId() === quizId) {
      this.showQRForQuizId.set(null);
    } else {
      this.showQRForQuizId.set(quizId);
    }
  }

  getQuizNumber(quizId: number): string {
    const quiz = this.hostQuizzes().find(q => q.quizId === quizId);
    return quiz?.quizNumber || '';
  }
}
