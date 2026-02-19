// import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable } from 'rxjs';
 
// @Injectable({
//   providedIn: 'root'
// })
// export class FeedbackService {
//   private apiUrl = 'https://localhost:7236/api/Feedback';
 
//   constructor(private http: HttpClient) { }
 
//   submitFeedback(feedback: any): Observable<any> {
//     return this.http.post(this.apiUrl, feedback, { 
//       withCredentials: false,
//       headers: { 'Content-Type': 'application/json' }
//     });
//   }
 
//   getFeedbackByQuiz(quizId: number): Observable<any> {
//     return this.http.get(`${this.apiUrl}/${quizId}`);
//   }
 
//   getAnalytics(quizId: number): Observable<any> {
//     return this.http.get(`${this.apiUrl}/analytics/${quizId}`);
//   }
 
//   getWordCloud(quizId: number): Observable<any> {
//     return this.http.get(`${this.apiUrl}/wordcloud/${quizId}`);
//   }
// }



// =================== NEW CODE ===================


import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface QuizFeedback {
  id: number;
  quizId: number;
  participantId: number;
  rating: number;
  comments?: string;       // <-- must be `comments`
  emojiReaction?: string;
}

export interface HostDto {
  hostId: string;
  hostName: string;
}

export interface HostQuizDto {
  quizId: number;
  quizName: string;
  createdAt?: Date;
}

export interface HostFeedbackAnalyticsDto {
  hostId: string;
  hostName: string;
  quizId: number;
  quizName: string;
  averageRating: number;
  totalResponses: number;
  emojiBreakdown: Array<{ emojiReaction: string; totalCount: number }>;
  ratingDistribution: Array<{ rating: number; count: number }>;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private baseUrl = `${environment.apiUrl}/Feedback`;

  constructor(private http: HttpClient) {}

  submitFeedback(payload: Partial<QuizFeedback>): Observable<any> {
    return this.http.post<any>(this.baseUrl, payload);
  }

  getFeedbackByQuiz(quizId: number): Observable<QuizFeedback[]> {
    return this.http.get<QuizFeedback[]>(`${this.baseUrl}/${quizId}`);
  }

  getAnalytics(quizId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/analytics/${quizId}`);
  }

  getWordCloud(quizId: number): Observable<Array<{ text: string; weight: number }>> {
    return this.http.get<Array<{ text: string; weight: number }>>(`${this.baseUrl}/wordcloud/${quizId}`);
  }

  // New methods for host-based analytics
  getAllHosts(): Observable<HostDto[]> {
    return this.http.get<HostDto[]>(`${this.baseUrl}/hosts/all`);
  }

  getQuizzesByHost(hostId: string): Observable<HostQuizDto[]> {
    return this.http.get<HostQuizDto[]>(`${this.baseUrl}/host/${hostId}/quizzes`);
  }

  getFeedbackAnalyticsByHostAndQuiz(hostId: string, quizId: number): Observable<HostFeedbackAnalyticsDto> {
    return this.http.get<HostFeedbackAnalyticsDto>(`${this.baseUrl}/host/${hostId}/quiz/${quizId}/analytics`);
  }
}
