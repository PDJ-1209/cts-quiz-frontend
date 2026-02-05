import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject, Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  QuizPublishData,
  QuizPublishRequest,
  QuizPublishResponse,
  QuizStatusUpdate,
  ParticipantJoinedData,
  QuizSessionData,
  QuizSessionEndData,
  ConnectionState
} from '../models/quiz-publish.models';

@Injectable({
  providedIn: 'root'
})
export class QuizPublishService {
  private http = inject(HttpClient);
  private apiBase = `${environment.apiUrl}/api/Host/QuizSession`;
  private hubConnection: signalR.HubConnection | null = null;
  
  // Connection state
  public connectionState$ = new BehaviorSubject<ConnectionState>('disconnected');
  
  // Real-time event streams
  public quizPublished$ = new Subject<QuizPublishData>();
  public quizStatusChanged$ = new Subject<QuizStatusUpdate>();
  public participantJoined$ = new Subject<ParticipantJoinedData>();
  public quizSessionStarted$ = new Subject<QuizSessionData>();
  public quizSessionEnded$ = new Subject<QuizSessionEndData>();
  
  constructor() {}

  /**
   * Initialize SignalR connection for quiz publishing
   * @param hostId - The host user ID
   */
  public async initializeConnection(hostId: string): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      console.log('[QuizPublish] Already connected');
      return;
    }

    this.connectionState$.next('connecting');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.signalRUrl}`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
        accessTokenFactory: () => {
          // Add your auth token here if needed
          return '';
        }
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: retryContext => {
          // Exponential backoff: 0s, 2s, 10s, 30s
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Register event handlers
    this.registerServerEvents();

    // Handle connection lifecycle
    this.hubConnection.onreconnecting(() => {
      console.log('[QuizPublish] Reconnecting...');
      this.connectionState$.next('connecting');
    });

    this.hubConnection.onreconnected(() => {
      console.log('[QuizPublish] Reconnected successfully');
      this.connectionState$.next('connected');
      // Rejoin host group after reconnection
      this.joinHostGroup(hostId);
    });

    this.hubConnection.onclose((error) => {
      console.error('[QuizPublish] Connection closed', error);
      this.connectionState$.next('disconnected');
    });

    try {
      await this.hubConnection.start();
      console.log('[QuizPublish] Connected to Quiz Hub');
      this.connectionState$.next('connected');
      
      // Join the host group to receive updates
      await this.joinHostGroup(hostId);
    } catch (error) {
      console.error('[QuizPublish] Connection failed:', error);
      this.connectionState$.next('disconnected');
      throw error;
    }
  }

  /**
   * Register handlers for server-to-client events
   */
  private registerServerEvents(): void {
    if (!this.hubConnection) return;

    // When a quiz is published
    this.hubConnection.on('QuizPublished', (data: QuizPublishData) => {
      console.log('[QuizPublish] Quiz published:', data);
      this.quizPublished$.next(data);
    });

    // When quiz status changes (DRAFT -> LIVE -> COMPLETED)
    this.hubConnection.on('QuizStatusChanged', (data: QuizStatusUpdate) => {
      console.log('[QuizPublish] Quiz status changed:', data);
      this.quizStatusChanged$.next(data);
    });

    // When a participant joins the quiz
    this.hubConnection.on('ParticipantJoinedQuiz', (data: ParticipantJoinedData) => {
      console.log('[QuizPublish] Participant joined:', data);
      this.participantJoined$.next(data);
    });

    // When quiz session starts
    this.hubConnection.on('QuizSessionStarted', (data: QuizSessionData) => {
      console.log('[QuizPublish] Quiz session started:', data);
      this.quizSessionStarted$.next(data);
    });

    // When quiz session ends
    this.hubConnection.on('QuizSessionEnded', (data: QuizSessionEndData) => {
      console.log('[QuizPublish] Quiz session ended:', data);
      this.quizSessionEnded$.next(data);
    });
  }

  /**
   * Join host group to receive updates for this host's quizzes
   */
  private async joinHostGroup(hostId: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      console.warn('[QuizPublish] Cannot join host group - not connected');
      return;
    }

    try {
      await this.hubConnection.invoke('JoinHostGroup', hostId);
      console.log(`[QuizPublish] Joined host group: ${hostId}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to join host group:', error);
    }
  }

  /**
   * Publish a quiz (make it LIVE) - Calls backend API
   * @param quizId - The quiz ID to publish
   * @param quizNumber - The quiz number
   * @param publishedBy - The host/user ID
   * @param scheduledTime - Optional scheduled publish time
   */
  public async publishQuiz(
    quizId: number, 
    quizNumber: string, 
    publishedBy: string,
    scheduledTime?: string
  ): Promise<QuizPublishResponse> {
    const url = `${this.apiBase}/publish`;
    
    const payload: QuizPublishRequest = {
      quizId,
      quizNumber,
      publishedBy,
      scheduledTime: scheduledTime || new Date().toISOString()
    };

    console.log('========================================');
    console.log('📤 PUBLISHING QUIZ - REQUEST PAYLOAD');
    console.log('========================================');
    console.log('URL:', url);
    console.log('Method: POST');
    console.log('Payload (JSON):', JSON.stringify(payload, null, 2));
    console.log('Payload (Object):', payload);
    console.log('========================================');

    try {
      const response = await firstValueFrom(
        this.http.post<QuizPublishResponse>(url, payload)
      );
      
      // Also record in Publish table for calendar
      await this.recordPublishForCalendar(quizId, publishedBy);
      
      console.log('========================================');
      console.log('✅ QUIZ PUBLISHED SUCCESSFULLY');
      console.log('========================================');
      console.log('Response (JSON):', JSON.stringify(response, null, 2));
      console.log('Response (Object):', response);
      console.log('========================================');
      return response;
    } catch (error: any) {
      console.error('========================================');
      console.error('❌ PUBLISH FAILED - ERROR DETAILS');
      console.error('========================================');
      console.error('Status:', error.status);
      console.error('Status Text:', error.statusText);
      console.error('Error Message:', error.error?.message || error.message);
      console.error('Backend Error (JSON):', JSON.stringify(error.error, null, 2));
      console.error('Full Error Object:', error);
      console.error('========================================');
      throw error;
    }
  }

  /**
   * Record quiz publish in Publish table for calendar tracking
   */
  private async recordPublishForCalendar(quizId: number, publishedBy: string): Promise<void> {
    const publishUrl = `${environment.apiUrl}/Host/Publish`;
    const publishPayload = {
      quizId: quizId,
      questionId: null,
      publishedBy: publishedBy
    };

    try {
      await firstValueFrom(
        this.http.post(publishUrl, publishPayload)
      );
      console.log('[QuizPublish] Recorded in Publish table for calendar');
    } catch (error) {
      console.error('[QuizPublish] Failed to record in Publish table:', error);
      // Don't throw error, as the main publish operation succeeded
    }
  }

  /**
   * Unpublish a quiz (set back to DRAFT) - Calls backend API
   */
  public async unpublishQuiz(quizNumber: string): Promise<void> {
    const url = `${this.apiBase}/unpublish?quizNumber=${encodeURIComponent(quizNumber)}`;
    
    try {
      await firstValueFrom(
        this.http.post(url, {})
      );
      console.log(`[QuizPublish] Unpublished quiz ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to unpublish quiz:', error);
      throw error;
    }
  }

  /**
   * Complete a quiz (set to COMPLETED) - Calls backend API
   */
  public async completeQuiz(quizNumber: string): Promise<void> {
    const url = `${this.apiBase}/complete?quizNumber=${encodeURIComponent(quizNumber)}`;
    
    try {
      await firstValueFrom(
        this.http.post(url, {})
      );
      console.log(`[QuizPublish] Completed quiz ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to complete quiz:', error);
      throw error;
    }
  }

  /**
   * Start quiz session (when participants can join and take quiz)
   */
  public async startQuizSession(quizNumber: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to Quiz Hub');
    }

    try {
      await this.hubConnection.invoke('StartQuizSession', quizNumber);
      console.log(`[QuizPublish] Started quiz session ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to start quiz session:', error);
      throw error;
    }
  }

  /**
   * End quiz session
   */
  public async endQuizSession(quizNumber: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to Quiz Hub');
    }

    try {
      await this.hubConnection.invoke('EndQuizSession', quizNumber);
      console.log(`[QuizPublish] Ended quiz session ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to end quiz session:', error);
      throw error;
    }
  }

  /**
   * Broadcast a message to all participants in a quiz
   */
  public async broadcastToParticipants(quizNumber: string, message: string, data?: any): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Not connected to Quiz Hub');
    }

    try {
      await this.hubConnection.invoke('BroadcastToQuizParticipants', quizNumber, message, data);
      console.log(`[QuizPublish] Broadcast message to quiz ${quizNumber}`);
    } catch (error) {
      console.error('[QuizPublish] Failed to broadcast message:', error);
      throw error;
    }
  }

  /**
   * Get active participants count for a quiz - Calls backend API
   */
  public async getActiveParticipants(quizNumber: string): Promise<number> {
    const url = `${this.apiBase}/${encodeURIComponent(quizNumber)}/participants/count`;
    
    try {
      const response = await firstValueFrom(
        this.http.get<{ quizNumber: string; participantCount: number }>(url)
      );
      return response.participantCount;
    } catch (error) {
      console.error('[QuizPublish] Failed to get active participants:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the hub
   */
  public async disconnect(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
        console.log('[QuizPublish] Disconnected from Quiz Hub');
        this.connectionState$.next('disconnected');
      } catch (error) {
        console.error('[QuizPublish] Error disconnecting:', error);
      }
    }
  }

  // Observable getters for components to subscribe
  public get connectionState(): Observable<ConnectionState> {
    return this.connectionState$.asObservable();
  }

  public get onQuizPublished(): Observable<QuizPublishData> {
    return this.quizPublished$.asObservable();
  }

  public get onQuizStatusChanged(): Observable<QuizStatusUpdate> {
    return this.quizStatusChanged$.asObservable();
  }

  public get onParticipantJoined(): Observable<ParticipantJoinedData> {
    return this.participantJoined$.asObservable();
  }

  public get onQuizSessionStarted(): Observable<QuizSessionData> {
    return this.quizSessionStarted$.asObservable();
  }

  public get onQuizSessionEnded(): Observable<QuizSessionEndData> {
    return this.quizSessionEnded$.asObservable();
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState$.value;
  }
}