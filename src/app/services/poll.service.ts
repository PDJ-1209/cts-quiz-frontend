import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { 
  Poll, 
  PollResult, 
  CreatePollRequest, 
  PollVoteSubmission, 
  ClosePollResponse, 
  PollVoteResponse, 
  CreatePollApiRequest, 
  PollOverview,
  RepublishPollRequest,
  RepublishPollResponse,
  SchedulePollRequest,
  SchedulePollResponse,
  PollResponse
} from '../models/ipoll';

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
      sessionCode: source?.sessionCode ?? source?.SessionCode ?? null,
      pollTitle: source?.pollTitle ?? source?.PollTitle ?? '',
      pollQuestion: source?.pollQuestion ?? source?.PollQuestion ?? '',
      pollAnonymous: source?.pollAnonymous ?? source?.PollAnonymous ?? false,
      pollStatus: source?.pollStatus ?? source?.PollStatus ?? 'draft',
      selectionType: source?.selectionType ?? source?.SelectionType ?? 'single',
      startTime: source?.startTime ?? source?.StartTime ?? null,
      endTime: source?.endTime ?? source?.EndTime ?? null,
      options: (source?.pollOptions ?? source?.PollOptions ?? []).map((opt: any) => ({
        optionId: opt?.optionId ?? opt?.OptionId,
        optionLabel: opt?.optionLabel ?? opt?.OptionLabel ?? '',
        optionOrder: opt?.optionOrder ?? opt?.OptionOrder ?? 0
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

  // Publish poll with custom start/end times
  publishPoll(publishPayload: { pollId: number; hostId: string; startedAt?: string; endedAt?: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/Host/Poll/publish`, publishPayload);
  }

  // Republish poll
  republishPoll(pollId: number, request: Partial<RepublishPollRequest> = {}): Observable<RepublishPollResponse> {
    const payload: RepublishPollRequest = {
      pollId,
      hostId: request.hostId || 'host-default',
      startedAt: request.startedAt,
      endedAt: request.endedAt,
      countdownDurationSeconds: request.countdownDurationSeconds || 45
    };
    return this.http.post<RepublishPollResponse>(`${environment.apiUrl}/Host/Poll/${pollId}/republish`, payload);
  }

  // Schedule poll
  schedulePoll(pollId: number, startTime: Date, endTime?: Date, countdownDuration: number = 45): Observable<SchedulePollResponse> {
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

    const payload: SchedulePollRequest = {
      pollId,
      hostId: 'host-default',
      scheduledStartTime: formatLocalDateTime(startTime),
      scheduledEndTime: endTime ? formatLocalDateTime(endTime) : undefined,
      countdownDurationSeconds: countdownDuration
    };
    return this.http.post<SchedulePollResponse>(`${environment.apiUrl}/Host/Poll/${pollId}/schedule`, payload);
  }

  // Get poll responses by participant
  getPollResponsesByParticipant(participantId: number, pollId: number): Observable<PollResponse[]> {
    return this.http.get<PollResponse[]>(
      `${environment.apiUrl}/Participate/Poll/responses/participant/${participantId}/poll/${pollId}`
    );
  }

  // End poll
  endPoll(pollId: number): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/Host/Poll/${pollId}/end`, {});
  }
}
