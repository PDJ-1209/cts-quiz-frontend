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
import { environment } from '../environments/environment';

export interface QuizFeedback {
  id: number;
  quizId: number;
  participantId: number;
  rating: number;
  comments?: string;       // <-- must be `comments`
  emojiReaction?: string;
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
}
