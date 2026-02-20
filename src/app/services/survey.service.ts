import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  Survey, 
  CreateSurveyRequest, 
  CreateSurveyResponse,
  PublishSurveyRequest,
  PublishSurveyResponse,
  SurveyResult,
  CreateSurveyApiRequest,
  SurveyOverview,
  WordCloudResponse,
  SurveyTextResponse
} from '../models/isurvey';
import { CreateQuizSessionRequest, CreateQuizSessionResponse } from '../models/quiz-publish.models';


@Injectable({
  providedIn: 'root'
})
export class SurveyService {
  private baseUrl = `${environment.apiUrl}`;
  private apiBaseV2 = `${environment.apiUrl}/Host/Survey`;

  constructor(private http: HttpClient) {}

  // --- Session Management ---
  
  createSession(request: CreateQuizSessionRequest): Observable<CreateQuizSessionResponse> {
    return this.http.post<CreateQuizSessionResponse>(`${this.baseUrl}/Host/QuizSession/create`, request);
  }

  getSessionDetails(sessionId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/Participate/Session/${sessionId}`);
  }

  startSurveyInSession(sessionId: number, surveyId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/Host/QuizSession/${sessionId}/status`, { status: 'Active' });
  }

  endSession(sessionId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/Host/QuizSession/${sessionId}/status`, { status: 'Completed' });
  }

  // --- Survey Management ---

  createSurvey(request: CreateSurveyRequest): Observable<CreateSurveyResponse> {
    const payload: CreateSurveyApiRequest = {
      sessionId: request.session_id && request.session_id > 0 ? request.session_id : null,
      title: request.title,
      description: request.description,
      isAnonymous: request.is_anonymous,
      status: 'draft',
      questions: (request.questions || []).map((q) => ({
        sessionId: request.session_id && request.session_id > 0 ? request.session_id : null,
        questionText: q.question_text,
        questionType: q.question_type,
        questionOrder: q.question_order,
        isRequired: q.is_required,
        scaleMin: q.scale_min,
        scaleMax: q.scale_max,
        options: (q.options || []).map((opt) => ({
          optionText: opt.option_text,
          displayOrder: opt.display_order,
          scoreValue: opt.score_value
        }))
      }))
    };

    console.log('[SurveyService] Sending payload to backend:', JSON.stringify(payload, null, 2));
    return this.http.post<CreateSurveyResponse>(this.apiBaseV2, payload as any);
  }

  // v2 backend create
  createSurveyV2(request: CreateSurveyApiRequest): Observable<SurveyOverview> {
    return this.http.post<any>(this.apiBaseV2, request).pipe(
      map((response) => this.mapSurveyOverview(response))
    );
  }

  // v2 backend list
  getAllSurveysV2(): Observable<SurveyOverview[]> {
    return this.http.get<any[]>(this.apiBaseV2).pipe(
      map((items) => (items || []).map((item) => this.mapSurveyOverview(item)))
    );
  }

  private mapSurveyOverview(source: any): SurveyOverview {
    return {
      surveyId: source?.surveyId ?? source?.SurveyId,
      sessionId: source?.sessionId ?? source?.SessionId,
      title: source?.title ?? source?.Title ?? '',
      description: source?.description ?? source?.Description ?? null,
      isAnonymous: source?.isAnonymous ?? source?.IsAnonymous ?? false,
      status: source?.status ?? source?.Status ?? '',
      questions: (source?.questions ?? source?.Questions ?? []).map((q: any) => ({
        surveyQuestionId: q?.surveyQuestionId ?? q?.SurveyQuestionId,
        sessionId: q?.sessionId ?? q?.SessionId,
        questionText: q?.questionText ?? q?.QuestionText ?? '',
        questionType: q?.questionType ?? q?.QuestionType ?? '',
        questionOrder: q?.questionOrder ?? q?.QuestionOrder ?? 0,
        isRequired: q?.isRequired ?? q?.IsRequired ?? false,
        scaleMin: q?.scaleMin ?? q?.ScaleMin ?? null,
        scaleMax: q?.scaleMax ?? q?.ScaleMax ?? null,
        options: (q?.options ?? q?.Options ?? []).map((opt: any) => ({
          optionId: opt?.optionId ?? opt?.OptionId,
          optionText: opt?.optionText ?? opt?.OptionText ?? '',
          displayOrder: opt?.displayOrder ?? opt?.DisplayOrder ?? 0,
          scoreValue: opt?.scoreValue ?? opt?.ScoreValue ?? null
        }))
      }))
    };
  }

  getSurveyById(surveyId: number): Observable<Survey> {
    return this.http.get<Survey>(`${this.apiBaseV2}/${surveyId}`);
  }

  publishSurvey(request: PublishSurveyRequest): Observable<PublishSurveyResponse> {
    return this.http.post<PublishSurveyResponse>(`${this.baseUrl}/survey/publish`, request);
  }

  getSurveyResults(surveyId: number): Observable<SurveyResult> {
    return this.http.get<SurveyResult>(`${this.baseUrl}/survey/results/${surveyId}`);
  }

  deleteSurvey(surveyId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/survey/${surveyId}`);
  }

  // --- New Quiz-Like Workflow Methods ---

  updateSurvey(surveyId: number, request: CreateSurveyApiRequest): Observable<SurveyOverview> {
    return this.http.put<any>(`${this.apiBaseV2}/${surveyId}`, request).pipe(
      map((response) => this.mapSurveyOverview(response))
    );
  }

  publishSurveyV2(surveyId: number, publishData: any): Observable<any> {
    return this.http.post<any>(`${this.apiBaseV2}/${surveyId}/publish`, publishData);
  }

  deleteSurveyV2(surveyId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiBaseV2}/${surveyId}`);
  }

  // Participant: get survey by session
  getParticipantSurveyBySession(sessionId: number): Observable<SurveyOverview> {
    return this.http.get<any>(`${environment.apiUrl}/Participate/Survey/session/${sessionId}`).pipe(
      map((response) => this.mapSurveyOverview(response))
    );
  }

  // Participant: submit survey responses
  submitSurveyResponses(payload: any): Observable<any> {
    return this.http.post(`${environment.apiUrl}/Participate/Survey/submit`, payload);
  }

  // --- Word Cloud Analytics ---
  
  /**
   * Generate word cloud from survey text responses
   */
  getWordCloud(surveyId: number, sessionId: number): Observable<WordCloudResponse> {
    return this.http.get<WordCloudResponse>(`${this.apiBaseV2}/${surveyId}/wordcloud/${sessionId}`);
  }

  /**
   * Get all text responses for analysis
   */
  getTextResponses(surveyId: number, sessionId: number): Observable<SurveyTextResponse[]> {
    return this.http.get<SurveyTextResponse[]>(`${this.apiBaseV2}/${surveyId}/text-responses/${sessionId}`);
  }
}