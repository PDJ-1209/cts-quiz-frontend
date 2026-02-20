import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SurveyPollSignalRService {
  private hubConnection: signalR.HubConnection | null = null;
  
  // Survey Observable Streams
  surveyQuestionReceived = new BehaviorSubject<any>(null);
  surveyAnswerSubmitted = new BehaviorSubject<any>(null);
  surveyResultsReceived = new BehaviorSubject<any>(null);
  surveyProgressUpdated = new BehaviorSubject<any>(null);
  surveySessionEnded = new BehaviorSubject<any>(null);
  
  // Poll Observable Streams
  pollQuestionReceived = new BehaviorSubject<any>(null);
  pollVoteSubmitted = new BehaviorSubject<any>(null);
  pollResultsReceived = new BehaviorSubject<any>(null);
  pollProgressUpdated = new BehaviorSubject<any>(null);
  pollSessionEnded = new BehaviorSubject<any>(null);
  
  // Connection status
  connectionStatus = new BehaviorSubject<'connecting' | 'connected' | 'disconnected'>('disconnected');

  constructor() {}

  /**
   * Connect to SignalR hub
   */
  connect(sessionCode: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return Promise.resolve();
    }

    this.connectionStatus.next('connecting');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.apiUrl + '/quiz-hub')
      .withAutomaticReconnect()
      .build();

    // Register survey event handlers
    this.registerSurveyListeners(sessionCode);
    
    // Register poll event handlers
    this.registerPollListeners(sessionCode);

    return this.hubConnection.start()
      .then(() => {
        console.log('[SurveyPollSignalR] Connected to hub');
        this.connectionStatus.next('connected');
        
        // Join group for this session
        this.hubConnection?.invoke('JoinGroup', sessionCode)
          .catch(err => console.error('[SurveyPollSignalR] Error joining group:', err));
      })
      .catch(err => {
        console.error('[SurveyPollSignalR] Connection failed:', err);
        this.connectionStatus.next('disconnected');
        throw err;
      });
  }

  /**
   * Register survey event listeners
   */
  private registerSurveyListeners(sessionCode: string): void {
    if (!this.hubConnection) return;

    // Survey Question Received
    this.hubConnection.on('ReceiveSurveyQuestion', (data: any) => {
      console.log('[SurveyPollSignalR] Survey question received:', data);
      this.surveyQuestionReceived.next(data);
    });

    // Survey Answer Submitted
    this.hubConnection.on('SurveyAnswerSubmitted', (data: any) => {
      console.log('[SurveyPollSignalR] Survey answer submitted:', data);
      this.surveyAnswerSubmitted.next(data);
    });

    // Survey Results Received
    this.hubConnection.on('SurveyResultsReceived', (data: any) => {
      console.log('[SurveyPollSignalR] Survey results received:', data);
      this.surveyResultsReceived.next(data);
    });

    // Survey Progress Updated
    this.hubConnection.on('SurveyProgressUpdated', (data: any) => {
      console.log('[SurveyPollSignalR] Survey progress updated:', data);
      this.surveyProgressUpdated.next(data);
    });

    // Survey Session Ended
    this.hubConnection.on('SurveySessionEnded', (data: any) => {
      console.log('[SurveyPollSignalR] Survey session ended:', data);
      this.surveySessionEnded.next(data);
    });
  }

  /**
   * Register poll event listeners
   */
  private registerPollListeners(sessionCode: string): void {
    if (!this.hubConnection) return;

    // Poll Question Received
    this.hubConnection.on('ReceivePollQuestion', (data: any) => {
      console.log('[SurveyPollSignalR] Poll question received:', data);
      this.pollQuestionReceived.next(data);
    });

    // Poll Vote Submitted
    this.hubConnection.on('PollVoteSubmitted', (data: any) => {
      console.log('[SurveyPollSignalR] Poll vote submitted:', data);
      this.pollVoteSubmitted.next(data);
    });

    // Poll Results Received
    this.hubConnection.on('PollResultsReceived', (data: any) => {
      console.log('[SurveyPollSignalR] Poll results received:', data);
      this.pollResultsReceived.next(data);
    });

    // Poll Progress Updated
    this.hubConnection.on('PollProgressUpdated', (data: any) => {
      console.log('[SurveyPollSignalR] Poll progress updated:', data);
      this.pollProgressUpdated.next(data);
    });

    // Poll Session Ended
    this.hubConnection.on('PollSessionEnded', (data: any) => {
      console.log('[SurveyPollSignalR] Poll session ended:', data);
      this.pollSessionEnded.next(data);
    });
  }

  /**
   * Send survey answer
   */
  async sendSurveyAnswer(sessionCode: string, surveyQuestionId: number, answer: any): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }
    
    await this.hubConnection.invoke('SendSurveyAnswer', sessionCode, surveyQuestionId, answer);
  }

  /**
   * Send poll vote
   */
  async sendPollVote(sessionCode: string, pollId: number, optionIds: number[]): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }
    
    await this.hubConnection.invoke('SendPollVote', sessionCode, pollId, optionIds);
  }

  /**
   * Request survey results
   */
  async requestSurveyResults(sessionCode: string, sessionId: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }
    
    await this.hubConnection.invoke('RequestSurveyResults', sessionCode, sessionId);
  }

  /**
   * Request poll results
   */
  async requestPollResults(sessionCode: string, pollId: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR not connected');
    }
    
    await this.hubConnection.invoke('RequestPollResults', sessionCode, pollId);
  }

  /**
   * Disconnect from hub
   */
  disconnect(): void {
    if (this.hubConnection) {
      this.hubConnection.stop()
        .then(() => {
          console.log('[SurveyPollSignalR] Disconnected from hub');
          this.connectionStatus.next('disconnected');
        })
        .catch(err => console.error('[SurveyPollSignalR] Disconnect error:', err));
    }
  }

  /**
   * Get connection status as observable
   */
  getConnectionStatus$(): Observable<'connecting' | 'connected' | 'disconnected'> {
    return this.connectionStatus.asObservable();
  }

  /**
   * Get survey question stream
   */
  getSurveyQuestion$(): Observable<any> {
    return this.surveyQuestionReceived.asObservable();
  }

  /**
   * Get survey results stream
   */
  getSurveyResults$(): Observable<any> {
    return this.surveyResultsReceived.asObservable();
  }

  /**
   * Get poll question stream
   */
  getPollQuestion$(): Observable<any> {
    return this.pollQuestionReceived.asObservable();
  }

  /**
   * Get poll results stream
   */
  getPollResults$(): Observable<any> {
    return this.pollResultsReceived.asObservable();
  }
}
