import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmojiSummary {
  emojiReaction: string;
  totalCount: number;
}

export interface RatingDistribution {
  rating: number;
  count: number;
}

export interface AnalyticsByQuiz {
  quizId: number;
  averageRating: number;
  totalResponses: number;
  emojiBreakdown: EmojiSummary[];
}

@Injectable({
  providedIn: 'root'
})
export class ServiceAnalyticsService {
  private baseUrl = `${environment.apiUrl}/Feedback`;

  constructor(private http: HttpClient) {}

  /**
   * Get emoji summary across all quizzes
   */
  getEmojiSummary(): Observable<EmojiSummary[]> {
    return this.http.get<EmojiSummary[]>(`${this.baseUrl}/emoji-summary`);
  }

  /**
   * Get rating distribution across all quizzes
   */
  getRatingDistribution(): Observable<RatingDistribution[]> {
    return this.http.get<RatingDistribution[]>(`${this.baseUrl}/rating-distribution`);
  }

  /**
   * Get analytics for a specific quiz
   */
  getAnalyticsByQuiz(quizId: number): Observable<AnalyticsByQuiz> {
    return this.http.get<AnalyticsByQuiz>(`${this.baseUrl}/analytics/${quizId}`);
  }

  /**
   * Get all feedback for a specific quiz
   */
  getFeedbackByQuiz(quizId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${quizId}`);
  }

  /**
   * Get word cloud data for a specific quiz
   */
  getWordCloud(quizId: number): Observable<Array<{ text: string; weight: number }>> {
    return this.http.get<Array<{ text: string; weight: number }>>(`${this.baseUrl}/wordcloud/${quizId}`);
  }
}
