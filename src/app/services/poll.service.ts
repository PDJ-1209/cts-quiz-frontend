import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Poll, PollResult, CreatePollRequest, PollVoteSubmission, ClosePollResponse, PollVoteResponse, CreatePollApiRequest, PollOverview } from '../models/ipoll';

@Injectable({
  providedIn: 'root'
})
export class PollService {
  private baseUrl = `${environment.apiUrl}/Host/Poll`;
  private apiBaseV2 = `${environment.apiUrl}/Host/Poll`;

  constructor(private http: HttpClient) {}

  // Create poll
  createPoll(poll: CreatePollRequest): Observable<PollOverview> {
    const payload: CreatePollApiRequest = {
      sessionId: poll.session_id,
      pollTitle: poll.poll_title,
      pollQuestion: poll.poll_question,
      pollAnonymous: poll.poll_anonymous,
      pollStatus: 'draft',
      selectionType: poll.selection_type,
      options: (poll.options || []).map(option => ({
        optionLabel: option.option_label,
        optionOrder: option.option_order
      }))
    };

    return this.createPollV2(payload);
  }

  // Create poll (v2 backend)
  createPollV2(poll: CreatePollApiRequest): Observable<PollOverview> {
    return this.http.post<any>(this.apiBaseV2, poll).pipe(
      map((response) => this.mapPollOverview(response))
    );
  }

  // Get all polls
  getAllPolls(): Observable<PollOverview[]> {
    return this.getAllPollsV2();
  }

  // Get all polls (v2 backend)
  getAllPollsV2(): Observable<PollOverview[]> {
    return this.http.get<any[]>(this.apiBaseV2).pipe(
      map((items) => (items || []).map((item) => this.mapPollOverview(item)))
    );
  }

  private mapPollOverview(source: any): PollOverview {
    return {
      pollId: source?.pollId ?? source?.PollId,
      sessionId: source?.sessionId ?? source?.SessionId,
      sessionCode: source?.sessionCode ?? source?.SessionCode,
      pollTitle: source?.pollTitle ?? source?.PollTitle ?? '',
      pollQuestion: source?.pollQuestion ?? source?.PollQuestion ?? '',
      pollAnonymous: source?.pollAnonymous ?? source?.PollAnonymous ?? false,
      pollStatus: source?.pollStatus ?? source?.PollStatus ?? '',
      selectionType: source?.selectionType ?? source?.SelectionType ?? '',
      options: (source?.options ?? source?.Options ?? []).map((opt: any) => ({
        optionId: opt?.optionId ?? opt?.OptionId,
        optionLabel: opt?.optionLabel ?? opt?.OptionLabel ?? '',
        optionOrder: opt?.optionOrder ?? opt?.OptionOrder
      }))
    };
  }

  // Get polls by session
  getPollsBySession(sessionId: number): Observable<PollOverview> {
    return this.getParticipantPollBySession(sessionId);
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
    return this.http.post<PollVoteResponse>(`${environment.apiUrl}/Participate/Poll/vote`, vote);
  }

  // Participant: get poll by session
  getParticipantPollBySession(sessionId: number): Observable<PollOverview> {
    return this.http.get<any>(`${environment.apiUrl}/Participate/Poll/session/${sessionId}`).pipe(
      map((response) => this.mapPollOverview(response))
    );
  }

  // Batch create polls
  createPollBatch(polls: CreatePollRequest[]): Observable<any> {
    const payloads: CreatePollApiRequest[] = polls.map(poll => ({
      sessionId: poll.session_id,
      pollTitle: poll.poll_title,
      pollQuestion: poll.poll_question,
      pollAnonymous: poll.poll_anonymous,
      pollStatus: 'draft',
      selectionType: poll.selection_type,
      options: (poll.options || []).map(option => ({
        optionLabel: option.option_label,
        optionOrder: option.option_order
      }))
    }));

    return this.http.post<any>(`${this.apiBaseV2}/batch`, payloads);
  }

  // Update poll
  updatePoll(pollId: number, poll: CreatePollRequest): Observable<PollOverview> {
    const payload: CreatePollApiRequest = {
      sessionId: poll.session_id,
      pollTitle: poll.poll_title,
      pollQuestion: poll.poll_question,
      pollAnonymous: poll.poll_anonymous,
      pollStatus: poll.poll_status || 'draft',
      selectionType: poll.selection_type,
      options: (poll.options || []).map(option => ({
        optionLabel: option.option_label,
        optionOrder: option.option_order
      }))
    };

    return this.http.put<any>(`${this.apiBaseV2}/${pollId}`, payload).pipe(
      map((response) => this.mapPollOverview(response))
    );
  }

  // Delete poll
  deletePoll(pollId: number): Observable<any> {
    return this.http.delete(`${this.apiBaseV2}/${pollId}`);
  }

  // Publish poll
  publishPoll(pollId: number, sessionId: number): Observable<any> {
    return this.http.post(`${this.apiBaseV2}/${pollId}/publish`, { sessionId });
  }

  // Get poll analytics
  getPollAnalytics(pollId: number): Observable<any> {
    return this.http.get(`${this.apiBaseV2}/${pollId}/analytics`);
  }
}
