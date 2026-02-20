import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SubmitPollAnswerDto,
  SubmitPollAnswerResponseDto,
  PollSessionSummaryDto,
  PollOverallResultDto
} from '../models/poll/submit-poll-answer.dto';

@Injectable({
  providedIn: 'root'
})
export class ParticipantPollService {
  private apiUrl = 'api/poll';

  constructor(private http: HttpClient) { }

  /**
   * Submit a poll vote
   */
  submitVote(vote: SubmitPollAnswerDto): Observable<SubmitPollAnswerResponseDto> {
    return this.http.post<SubmitPollAnswerResponseDto>(`${this.apiUrl}/answer`, vote);
  }

  /**
   * Get poll session summary and voting stats
   */
  getSessionSummary(sessionId: number): Observable<PollSessionSummaryDto> {
    return this.http.get<PollSessionSummaryDto>(`${this.apiUrl}/session/${sessionId}/summary`);
  }

  /**
   * Get overall poll results with vote distribution
   */
  getPollResults(pollId: number): Observable<PollOverallResultDto> {
    return this.http.get<PollOverallResultDto>(`${this.apiUrl}/poll/${pollId}/results`);
  }

  /**
   * Get live poll results for real-time display
   */
  getLiveResults(pollId: number): Observable<PollOverallResultDto> {
    return this.http.get<PollOverallResultDto>(`${this.apiUrl}/poll/${pollId}/results?live=true`);
  }
}
