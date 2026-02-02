// src/app/services/participant.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** ===== Participant Domain Models ===== */

export interface JoinQuizRequest {
  quizCode: string;
  participantName: string;
}

export interface JoinQuizResponse {
  sessionId: string;
  quiz_name: string;
  totalQuestions: number;
  timeLimit: number;
  success: boolean;
}

export interface QuestionResponse {
  questionId: string;
  questionText: string;
  options: {
    optionId: string;
    optionText: string;
  }[];
  questionNumber: number;
  totalQuestions: number;
  timeLimit: number;
}

export interface SubmitAnswerPayload {
  sessionId: string;
  questionId: string;
  selectedOptionId: string;
  timeSpent: number;
}

export interface AnswerResponse {
  isCorrect: boolean;
  correctOptionId: string;
  explanation?: string;
  nextQuestionAvailable: boolean;
  success: boolean;
}

export interface QuizResultsResponse {
  participantName: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  percentage: number;
  timeSpent: number;
  rank: number;
  leaderboard: {
    participantName: string;
    score: number;
    percentage: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class ParticipantService {
  private readonly apiBase = '/api/Participate';
  private http = inject(HttpClient);

  // Current session state
  private _currentSession = signal<string | null>(null);
  private _currentQuestion = signal<QuestionResponse | null>(null);
  private _quizResults = signal<QuizResultsResponse | null>(null);

  // Public readonly accessors
  currentSession = this._currentSession.asReadonly();
  currentQuestion = this._currentQuestion.asReadonly();
  quizResults = this._quizResults.asReadonly();

  /**
   * Join a quiz session with quiz code and participant name
   */
  async joinQuiz(quizCode: string, participantName: string): Promise<JoinQuizResponse> {
    const url = `${this.apiBase}/Join`;
    const payload: JoinQuizRequest = { quizCode, participantName };
    
    try {
      const response = await firstValueFrom(
        this.http.post<JoinQuizResponse>(url, payload)
      );
      
      if (response.success) {
        this._currentSession.set(response.sessionId);
      }
      
      return response;
    } catch (error: any) {
      console.error('Join quiz failed:', error);
      throw new Error(`Failed to join quiz: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Get the current question for the session
   */
  async getCurrentQuestion(sessionId: string): Promise<QuestionResponse> {
    const url = `${this.apiBase}/Question/${sessionId}`;
    
    try {
      const response = await firstValueFrom(
        this.http.get<QuestionResponse>(url)
      );
      
      this._currentQuestion.set(response);
      return response;
    } catch (error: any) {
      console.error('Get current question failed:', error);
      throw new Error(`Failed to get question: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Submit an answer for the current question
   */
  async submitAnswer(payload: SubmitAnswerPayload): Promise<AnswerResponse> {
    const url = `${this.apiBase}/Answer`;
    
    try {
      const response = await firstValueFrom(
        this.http.post<AnswerResponse>(url, payload)
      );
      
      return response;
    } catch (error: any) {
      console.error('Submit answer failed:', error);
      throw new Error(`Failed to submit answer: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Get quiz results for the session
   */
  async getResults(sessionId: string): Promise<QuizResultsResponse> {
    const url = `${this.apiBase}/Results/${sessionId}`;
    
    try {
      const response = await firstValueFrom(
        this.http.get<QuizResultsResponse>(url)
      );
      
      this._quizResults.set(response);
      return response;
    } catch (error: any) {
      console.error('Get results failed:', error);
      throw new Error(`Failed to get results: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Leave the current quiz session
   */
  async leaveQuiz(sessionId: string): Promise<void> {
    const url = `${this.apiBase}/Leave/${sessionId}`;
    
    try {
      await firstValueFrom(this.http.post<void>(url, {}));
      this._currentSession.set(null);
      this._currentQuestion.set(null);
      this._quizResults.set(null);
    } catch (error: any) {
      console.error('Leave quiz failed:', error);
      // Don't throw error for leave operation - just clean up local state
      this._currentSession.set(null);
      this._currentQuestion.set(null);
      this._quizResults.set(null);
    }
  }

  /**
   * Get quiz information by code (before joining)
   */
  async getQuizInfo(quizCode: string): Promise<any> {
    const url = `${this.apiBase}/Info/${quizCode}`;
    
    try {
      return await firstValueFrom(
        this.http.get<any>(url)
      );
    } catch (error: any) {
      console.error('Get quiz info failed:', error);
      throw new Error(`Failed to get quiz info: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Clear current session state
   */
  clearSession(): void {
    this._currentSession.set(null);
    this._currentQuestion.set(null);
    this._quizResults.set(null);
  }
}