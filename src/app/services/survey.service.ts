import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  Survey, 
  CreateSurveyRequest, 
  CreateSurveyResponse,
  PublishSurveyRequest,
  PublishSurveyResponse,
  SurveyResult
} from '../Models/isurvey';
import { 
  Session, 
  CreateSessionRequest } from '../Models/isession';


@Injectable({
  providedIn: 'root'
})
export class SurveyService {
  private baseUrl = `${environment.apiUrl}/host`;

  constructor(private http: HttpClient) {}

  // --- Session Management ---
  
  createSession(request: CreateSessionRequest): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/session/create`, request);
  }

  getSessionDetails(sessionId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/session/${sessionId}`);
  }

  getSessionsByEmployee(employeeId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/session/list/${employeeId}`);
  }

  startSurveyInSession(sessionId: number, surveyId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/session/start-survey`, { sessionId, surveyId });
  }

  endSession(sessionId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/session/${sessionId}/end`, {});
  }

  // --- Survey Management ---

  createSurvey(request: CreateSurveyRequest): Observable<CreateSurveyResponse> {
    return this.http.post<CreateSurveyResponse>(`${this.baseUrl}/survey/create`, request);
  }

  getSurveyById(surveyId: number): Observable<Survey> {
    return this.http.get<Survey>(`${this.baseUrl}/survey/${surveyId}`);
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
}