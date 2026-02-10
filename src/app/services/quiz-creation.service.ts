// src/app/services/quiz-creation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  QuizQuestion, 
  QuizMeta, 
  QuizListItem, 
  QuizDetailsResponse,
  CreateQuizResponse 
} from '../models/quiz.models';

export interface CreateQuizPayload {
  quizName: string;
  category: string;
  createdBy: string;
  status: string;
  questions: {
    questionText: string;
    questionType: string;
    category?: string;
    difficultyLevel?: string;
    tags?: string;
    timerSeconds?: number;
    options: {
      optionText: string;
      isCorrect: boolean;
    }[];
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class QuizCreationService {
  private readonly apiBase = `${environment.apiUrl}/Host/Quiz`;

  constructor(private http: HttpClient) {}

  /**
   * Sync quiz status - Reset to Draft if no active session exists
   */
  async syncQuizStatus(quizId: number): Promise<void> {
    const url = `${this.apiBase}/${quizId}/sync-status`;
    await firstValueFrom(this.http.post(url, {}));
    console.log(`[QuizCreationService] Synced status for Quiz ${quizId} back to Draft`);
  }

  /**
   * Create a new quiz with questions
   */
  async createQuiz(quiz: QuizMeta, questions: QuizQuestion[]): Promise<CreateQuizResponse> {
    if (!quiz || questions.length === 0) {
      throw new Error('Quiz meta or questions missing.');
    }

    if (questions.length < 1 || questions.length > 25) {
      throw new Error('You can create a quiz with 1 to 25 questions.');
    }

    const payload = this.mapToBackendPayload(quiz, questions);
    const url = `${this.apiBase}/CreateBulk`;
    
    console.log('=== CREATE QUIZ DEBUG ===');
    console.log('API URL:', url);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      console.log('Request headers:', headers);
      const res = await firstValueFrom(this.http.post<CreateQuizResponse>(url, payload, { headers }));
      console.log('CreateQuiz SUCCESS response:', res);
      return res;
    } catch (error: any) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Get all quizzes created by a specific host
   */
  async getHostQuizzes(hostName: string): Promise<QuizListItem[]> {
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    const url = `${this.apiBase}/GetByHost?createdBy=${encodeURIComponent(hostName)}&_t=${timestamp}`;
    try {
      const response: any = await firstValueFrom(this.http.get<any>(url));
      console.log('Raw API response:', response);
      const quizzes = response.data || response;
      console.log('Parsed quizzes:', quizzes);
      
      // Map to handle both PascalCase and camelCase property names
      return quizzes.map((quiz: any) => ({
        quizId: quiz.QuizId || quiz.quizId,
        quizName: quiz.QuizName || quiz.quizName,
        quizNumber: quiz.QuizNumber || quiz.quizNumber,
        category: quiz.Category || quiz.category,
        questionCount: quiz.QuestionCount || quiz.questionCount,
        templateId: quiz.TemplateId || quiz.templateId,
        createdBy: quiz.CreatedBy || quiz.createdBy,
        updatedBy: quiz.UpdatedBy || quiz.updatedBy,
        createdAt: quiz.CreatedAt || quiz.createdAt,
        updatedAt: quiz.UpdatedAt || quiz.updatedAt,
        status: quiz.Status || quiz.status
      }));
    } catch (error: any) {
      console.error('Error fetching host quizzes:', error);
      throw new Error(`Failed to fetch quizzes: ${error?.message || 'Unknown error'}`);
    }
  }



  /**
   * Get quiz details with questions for editing
   */
  async getQuizForEdit(quizId: number): Promise<QuizDetailsResponse> {
    const url = `${this.apiBase}/${quizId}`;
    try {
      return await firstValueFrom(this.http.get<QuizDetailsResponse>(url));
    } catch (error: any) {
      console.error('Error fetching quiz details:', error);
      throw new Error(`Failed to fetch quiz: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Update an existing quiz
   */
  async updateQuiz(quizId: number, payload: any): Promise<any> {
    const url = `${this.apiBase}/${quizId}`;
    try {
      return await firstValueFrom(this.http.put<any>(url, payload));
    } catch (error: any) {
      console.error('Error updating quiz:', error);
      throw new Error(`Failed to update quiz: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Update a single question
   */
  async updateQuestion(questionId: number, questionData: any): Promise<any> {
    const url = `${environment.apiUrl}/Host/Question/${questionId}`;
    try {
      console.log('Updating question:', questionId, questionData);
      const response = await firstValueFrom(this.http.put<any>(url, questionData));
      console.log('Question updated successfully:', response);
      return response;
    } catch (error: any) {
      console.error('Error updating question:', error);
      throw new Error(`Failed to update question: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Delete a quiz
   */
  async deleteQuiz(quizId: number): Promise<void> {
    const url = `${this.apiBase}/${quizId}`;
    try {
      await firstValueFrom(this.http.delete<void>(url));
    } catch (error: any) {
      console.error('Error deleting quiz:', error);
      throw new Error(`Failed to delete quiz: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Publish a quiz
   */
  async publishQuiz(quizId: number): Promise<any> {
    const url = `${this.apiBase}/${quizId}/Publish`;
    try {
      return await firstValueFrom(this.http.post<any>(url, {}));
    } catch (error: any) {
      console.error('Error publishing quiz:', error);
      throw new Error(`Failed to publish quiz: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Map frontend model to backend format
   */
  private mapToBackendPayload(quiz: QuizMeta, questions: QuizQuestion[]): CreateQuizPayload {
    return {
      quizName: quiz.quizName,
      category: quiz.category,
      createdBy: '2463579',
      status: 'Draft',
      questions: questions.map(q => ({
        questionText: q.text,
        questionType: this.mapQuestionType(q.type),
        category: quiz.category,
        difficultyLevel: 'Medium',
        timerSeconds: q.timerSeconds ?? 30,
        options: q.options.map(o => ({ 
          optionText: o.text, 
          isCorrect: o.isCorrect 
        }))
      }))
    };
  }

  /**
   * Map question type from frontend to backend format
   */
  private mapQuestionType(type: string): string {
    switch (type) {
      case 'Multiple Choice': return 'MCQ';
      case 'True/False': return 'TrueFalse';
      case 'Short Answer': return 'ShortAnswer';
      default: return 'MCQ';
    }
  }

  /**
   * Handle API errors with detailed logging
   */
  private handleApiError(error: any): void {
    console.error('=== CREATE QUIZ ERROR ===');
    console.error('Full error object:', error);
    console.error('Error status:', error?.status);
    console.error('Error statusText:', error?.statusText);
    console.error('Error message:', error?.message);
    console.error('Error response body:', error?.error);
    
    const message = error?.error?.message || error?.error?.title || error?.message || 'Unknown error';
    throw new Error(`Server error: ${message}`);
  }
}