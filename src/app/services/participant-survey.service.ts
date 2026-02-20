import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SubmitSurveyAnswerDto,
  SubmitSurveyAnswerResponseDto,
  SurveySessionSummaryDto,
  SurveyResultDto,
  SurveyQuestionResultDto
} from '../models/survey/submit-survey-answer.dto';

@Injectable({
  providedIn: 'root'
})
export class ParticipantSurveyService {
  private apiUrl = 'api/survey';

  constructor(private http: HttpClient) { }

  /**
   * Submit a survey answer
   */
  submitAnswer(answer: SubmitSurveyAnswerDto): Observable<SubmitSurveyAnswerResponseDto> {
    return this.http.post<SubmitSurveyAnswerResponseDto>(`${this.apiUrl}/answer`, answer);
  }

  /**
   * Get survey session summary and participation stats
   */
  getSessionSummary(sessionId: number): Observable<SurveySessionSummaryDto> {
    return this.http.get<SurveySessionSummaryDto>(`${this.apiUrl}/session/${sessionId}/summary`);
  }

  /**
   * Get survey results with all responses aggregated
   */
  getSurveyResults(sessionId: number): Observable<SurveyResultDto[]> {
    return this.http.get<SurveyResultDto[]>(`${this.apiUrl}/session/${sessionId}/results`);
  }

  /**
   * Get aggregated results by question
   */
  getQuestionResults(sessionId: number): Observable<SurveyQuestionResultDto[]> {
    return this.http.get<SurveyQuestionResultDto[]>(`${this.apiUrl}/session/${sessionId}/question-results`);
  }
}
