import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Poll, PollResult, CreatePollRequest, PollVoteSubmission, CreatePollResponse, ClosePollResponse, PollListResponse, PollVoteResponse } from '../models/ipoll';

@Injectable({
  providedIn: 'root'
})
export class PollService {
  private baseUrl = `${environment.apiUrl}/host/poll`;

  constructor(private http: HttpClient) {}

  // Create poll
  createPoll(poll: CreatePollRequest): Observable<CreatePollResponse> {
    return this.http.post<CreatePollResponse>(`${this.baseUrl}/create`, poll);
  }

  // Get all polls
  getAllPolls(): Observable<PollListResponse> {
    return this.http.get<PollListResponse>(`${this.baseUrl}/list`);
  }

  // Get polls by session
  getPollsBySession(sessionId: number): Observable<Poll[]> {
    return this.http.get<Poll[]>(`${this.baseUrl}/session/${sessionId}`);
  }

  // Get poll results
  getPollResults(pollId: number): Observable<PollResult> {
    return this.http.get<PollResult>(`${this.baseUrl}/results/${pollId}`);
  }

  // Close poll
  closePoll(pollId: number): Observable<ClosePollResponse> {
    return this.http.post<ClosePollResponse>(`${this.baseUrl}/close/${pollId}`, {});
  }

  // Submit poll vote (participant)
  submitPollVote(vote: PollVoteSubmission): Observable<PollVoteResponse> {
    return this.http.post<PollVoteResponse>(`${environment.apiUrl}/participant/poll/vote`, vote);
  }
}
