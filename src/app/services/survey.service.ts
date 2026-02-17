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
  SurveyResponse,
  RepublishSurveyRequest,
  RepublishSurveyResponse,
  ScheduleSurveyRequest,
  ScheduleSurveyResponse
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
      sessionId: request.session_id ?? null,
      title: request.title,
      description: request.description,
      isAnonymous: request.is_anonymous,
      status: 'draft',
      questions: (request.questions || []).map((q) => ({
        sessionId: request.session_id ?? 0,
        questionText: q.question_text,
        questionType: q.question_type,
        questionOrder: q.question_order,
        isRequired: q.is_required,
        scaleMin: q.scale_min,
        scaleMax: q.scale_max,
        options: (q.options || []).map((opt) => ({
          optionText: opt.option_text,
          displayOrder: opt.display_order
        }))
      }))
    };

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
      sessionCode: source?.sessionCode ?? source?.SessionCode ?? null,
      title: source?.title ?? source?.Title ?? '',
      description: source?.description ?? source?.Description ?? null,
      isAnonymous: source?.isAnonymous ?? source?.IsAnonymous ?? false,
      status: source?.status ?? source?.Status ?? 'draft',
      startTime: source?.startTime ?? source?.StartTime ?? null,
      endTime: source?.endTime ?? source?.EndTime ?? null,
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

  getSurveyResults(surveyId: number): Observable<SurveyResult> {
    return this.http.get<SurveyResult>(`${this.baseUrl}/survey/results/${surveyId}`);
  }

  deleteSurvey(surveyId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/survey/${surveyId}`);
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

  // Publish survey with custom start/end times
  publishSurvey(publishPayload: { surveyId: number; hostId: string; startedAt?: string; endedAt?: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/Host/Survey/publish`, publishPayload);
  }

  // NEW: Submit a single survey response (for multi-select and ranking support)
  submitSurveyResponse(response: SurveyResponse): Observable<any> {
    return this.http.post(`${environment.apiUrl}/Participate/Survey/submit`, response);
  }

  // NEW: Get survey responses by participant
  getSurveyResponsesByParticipant(participantId: number, surveyId: number): Observable<SurveyResponse[]> {
    return this.http.get<SurveyResponse[]>(
      `${environment.apiUrl}/Participate/Survey/responses/participant/${participantId}/survey/${surveyId}`
    );
  }

  // Republish survey
  republishSurvey(surveyId: number, request: Partial<RepublishSurveyRequest> = {}): Observable<RepublishSurveyResponse> {
    const payload: RepublishSurveyRequest = {
      surveyId,
      hostId: request.hostId || 'host-default',
      startedAt: request.startedAt,
      endedAt: request.endedAt,
      countdownDurationSeconds: request.countdownDurationSeconds || 45
    };
    return this.http.post<RepublishSurveyResponse>(`${environment.apiUrl}/Host/Survey/${surveyId}/republish`, payload);
  }

  // Schedule survey
  scheduleSurvey(surveyId: number, startTime: Date, endTime?: Date, countdownDuration: number = 45): Observable<ScheduleSurveyResponse> {
    // Format datetime in ISO-like format but without timezone conversion (keeps IST)
    const formatLocalDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const payload: ScheduleSurveyRequest = {
      surveyId,
      hostId: 'host-default',
      scheduledStartTime: formatLocalDateTime(startTime),
      scheduledEndTime: endTime ? formatLocalDateTime(endTime) : undefined,
      countdownDurationSeconds: countdownDuration
    };
    return this.http.post<ScheduleSurveyResponse>(`${environment.apiUrl}/Host/Survey/${surveyId}/schedule`, payload);
  }

  // End survey
  endSurvey(surveyId: number): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/Host/Survey/${surveyId}/end`, {});
  }
}
