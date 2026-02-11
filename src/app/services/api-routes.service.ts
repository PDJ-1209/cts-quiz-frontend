import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiRoutesService {
  private baseUrl = environment.apiUrl;

  // Admin Area Routes (api/admin/*)
  admin = {
    auth: {
      login: `${this.baseUrl}/admin/auth/login`,
      register: `${this.baseUrl}/admin/auth/register`
    },
    dashboard: `${this.baseUrl}/admin`,
    metrics: `${this.baseUrl}/admin/metrics`,
    userManagement: `${this.baseUrl}/userManagement`, // Note: This doesn't follow area pattern
    templates: `${this.baseUrl}/template` // Note: This doesn't follow area pattern
  };

  // Host Area Routes (api/Host/*)
  host = {
    quiz: `${this.baseUrl}/Host/quiz`,
    question: `${this.baseUrl}/Host/question`, 
    quizSession: `${this.baseUrl}/Host/QuizSession`,
    publish: `${this.baseUrl}/Host/publish`
  };

  // Participate Area Routes (api/participate/*)
  participate = {
    quiz: `${this.baseUrl}/participate/quiz`,
    session: `${this.baseUrl}/participate/session`
  };

  // General Routes (api/*)
  general = {
    home: `${this.baseUrl}/home`
  };

  // SignalR Hub
  signalR = {
    quizHub: environment.signalRUrl
  };
}