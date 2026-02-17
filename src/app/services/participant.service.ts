// src/app/services/participant.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  ValidateSessionResponse, 
  JoinSessionRequest, 
  ParticipantResponse,
  SessionQuestionsResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse
} from '../models/participant.models';

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
  private readonly apiBase = `${environment.apiUrl}/participate`;
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

  /**
   * Validate session code - check if it's active
   */
  async validateSessionCode(sessionCode: string): Promise<ValidateSessionResponse> {
    const url = `${this.apiBase}/session/validate`;
    
    try {
      console.log(`[ParticipantService] Validating session code: ${sessionCode}`);
      const response: any = await firstValueFrom(
        this.http.post<any>(url, JSON.stringify(sessionCode), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
      console.log('[ParticipantService] Validation response:', response);
      
      // Map to handle both PascalCase and camelCase
      return {
        isValid: response.IsValid ?? response.isValid,
        sessionId: response.SessionId ?? response.sessionId,
        quizId: response.QuizId ?? response.quizId,
        pollId: response.PollId ?? response.pollId,
        surveyId: response.SurveyId ?? response.surveyId,
        quizTitle: response.QuizTitle ?? response.quizTitle,
        sessionType: response.SessionType ?? response.sessionType,
        startedAt: response.StartedAt ?? response.startedAt,
        endedAt: response.EndedAt ?? response.endedAt,
        status: response.Status ?? response.status,
        message: response.Message ?? response.message
      };
    } catch (error: any) {
      console.error('Validate session failed:', error);
      throw new Error(`Failed to validate session: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Join session - create participant entry
   * Enhanced with detailed error logging to debug 400 Bad Request errors
   */
  async joinSession(request: JoinSessionRequest): Promise<ParticipantResponse> {
    const url = `${this.apiBase}/session/join`;
    
    try {
      console.log('[ParticipantService] === JOIN SESSION REQUEST ===');
      console.log('[ParticipantService] URL:', url);
      console.log('[ParticipantService] Request payload:', JSON.stringify(request, null, 2));
      
      const response: any = await firstValueFrom(
        this.http.post<any>(url, request)
      );
      
      console.log('[ParticipantService] === JOIN SESSION SUCCESS ===');
      console.log('[ParticipantService] Response:', response);
      
      // Map to handle both PascalCase and camelCase
      return {
        participantId: response.ParticipantId ?? response.participantId,
        sessionId: response.SessionId ?? response.sessionId,
        nickname: response.Nickname ?? response.nickname,
        employeeId: response.EmployeeId ?? response.employeeId,
        totalScore: response.TotalScore ?? response.totalScore,
        joinedAt: response.JoinedAt ?? response.joinedAt
      };
    } catch (error: any) {
      console.error('[ParticipantService] === JOIN SESSION FAILED ===');
      console.error('[ParticipantService] Error status:', error?.status);
      console.error('[ParticipantService] Error message:', error?.error?.message || error?.message);
      console.error('[ParticipantService] Full error:', error);
      
      // Extract the error message from backend
      const errorMessage = error?.error?.message || error?.message || 'Unknown error';
      throw new Error(`Failed to join session: ${errorMessage}`);
    }
  }

  /**
   * Get all questions for a session
   */
  async getSessionQuestions(sessionId: number): Promise<SessionQuestionsResponse> {
    const url = `${this.apiBase}/session/${sessionId}/questions`;
    
    try {
      console.log(`[ParticipantService] Fetching questions for session: ${sessionId}`);
      const response: any = await firstValueFrom(
        this.http.get<any>(url)
      );
      console.log('[ParticipantService] Questions response:', response);
      
      // Map to handle both PascalCase and camelCase
      return {
        sessionId: response.SessionId ?? response.sessionId,
        quizId: response.QuizId ?? response.quizId,
        quizTitle: response.QuizTitle ?? response.quizTitle,
        totalQuestions: response.TotalQuestions ?? response.totalQuestions,
        startedAt: response.StartedAt ?? response.startedAt,
        serverTime: response.ServerTime ?? response.serverTime,
        questions: (response.Questions ?? response.questions)?.map((q: any) => ({
          questionId: q.QuestionId ?? q.questionId,
          questionText: q.QuestionText ?? q.questionText,
          questionType: q.QuestionType ?? q.questionType,
          timerSeconds: q.TimerSeconds ?? q.timerSeconds ?? 30,
          options: (q.Options ?? q.options)?.map((o: any) => ({
            optionId: o.OptionId ?? o.optionId,
            optionText: o.OptionText ?? o.optionText
          })) ?? []
        })) ?? []
      };
    } catch (error: any) {
      console.error('Get session questions failed:', error);
      throw new Error(`Failed to get questions: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Submit participant's answer for a question
   */
  async submitParticipantAnswer(request: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
    const url = `${this.apiBase}/session/submit-answer`;
    
    try {
      console.log('[ParticipantService] Submitting answer:', request);
      console.log('[ParticipantService] Request URL:', url);
      console.log('[ParticipantService] Request body:', JSON.stringify(request));
      
      const response: any = await firstValueFrom(
        this.http.post<any>(url, request)
      );
      console.log('[ParticipantService] Submit answer response:', response);
      
      // Map to handle both PascalCase and camelCase
      return {
        isCorrect: response.IsCorrect ?? response.isCorrect,
        correctOptionId: response.CorrectOptionId ?? response.correctOptionId,
        explanation: response.Explanation ?? response.explanation
      };
    } catch (error: any) {
      console.error('Submit answer failed:', error);
      console.error('Error status:', error?.status);
      console.error('Error response:', error?.error);
      console.error('Error message:', error?.message);
      
      // If backend returned HTML error, try to extract useful info
      if (error?.error && typeof error.error === 'string') {
        console.error('HTML Error Response (first 500 chars):', error.error.substring(0, 500));
      }
      
      throw new Error(`Failed to submit answer: ${error?.error?.message || error?.message || 'Unknown error'}`);
    }
  }
}