// src/app/services/quiz-creation.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  QuizQuestion, 
  QuizMeta, 
  QuizListItem, 
  QuizDetailsResponse,
  CreateQuizResponse 
} from '../models/quiz.models';

export interface CreateQuizPayload {
  QuizName: string;
  quizDescription: string;
  category: string;
  difficulty: string;
  timeLimit: number;
  createdBy: string;
  questions: {
    questionText: string;
    questionType: string;
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
  private readonly apiBase = 'http://localhost:5195/api/Host/Quiz';

  constructor(private http: HttpClient) {}

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
    const url = `${this.apiBase}/GetByHost?createdBy=${encodeURIComponent(hostName)}`;
    try {
      const response: any = await firstValueFrom(this.http.get<any>(url));
      return response.data || response;
    } catch (error: any) {
      console.error('Error fetching host quizzes:', error);
      throw new Error(`Failed to fetch quizzes: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Get quiz details with questions for editing
   */
  async getQuizForEdit(quizId: number): Promise<QuizDetailsResponse> {
    const url = `${this.apiBase}/GetForEdit?quizId=${quizId}`;
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
      QuizName: quiz.quizName,
      quizDescription: '',
      category: quiz.category,
      difficulty: 'Medium',
      timeLimit: 0,
      createdBy: '2463579',
      questions: questions.map(q => ({
        questionText: q.text,
        questionType: this.mapQuestionType(q.type),
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