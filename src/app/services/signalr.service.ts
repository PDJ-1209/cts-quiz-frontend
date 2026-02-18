import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../environments/environment';

// Define interfaces for type safety
interface SurveyData {
  surveyId: number;
  sessionId: number;
  [key: string]: unknown;
}

interface ParticipantData {
  participantId: number;
  sessionId: number;
  name?: string;
  [key: string]: unknown;
}

interface SessionStatusData {
  sessionId: number;
  status: string;
  [key: string]: unknown;
}

interface ReceiveQuestionData {
  sessionCode?: string;
  participantId?: number;
  currentQuestion: number;
  serverTimeUtc?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SignalrService {
  private hubConnection!: signalR.HubConnection;
  
  // Real-time Event Streams with proper typing
  public surveyStarted$ = new Subject<SurveyData>();
  public newSurveyReceived$ = new Subject<SurveyData>();
  public participantJoined$ = new Subject<ParticipantData>();
  public sessionStatusChanged$ = new Subject<SessionStatusData>();
  public sessionEnded$ = new Subject<{ sessionId: number; [key: string]: unknown }>();
  public receiveQuestion$ = new Subject<ReceiveQuestionData>();
  
  // Leaderboard Event Streams
  public leaderboardUpdated$ = new Subject<any>();
  public hostLeaderboardUpdated$ = new Subject<any>();
  public participantCountUpdated$ = new Subject<number>();
  public leaderboardVisibilityChanged$ = new Subject<boolean>();
  public scoreUpdated$ = new Subject<any>();
  public showLeaderboard$ = new Subject<any>();
  public showHostLeaderboard$ = new Subject<any>();
  
  // Connection state
  public connectionEstablished$ = new BehaviorSubject<boolean>(false);
  public leaderboardConnectionEstablished$ = new BehaviorSubject<boolean>(false);

  // Leaderboard Hub Connection (separate from main hub)
  private leaderboardHubConnection!: signalR.HubConnection;

  constructor() {}

  /**
   * Initializes connection and joins the specific session group
   */
  public initHubConnection(sessionCode: string): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.signalRUrl}`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => {
        console.log(`[SignalR] Connected to Hub for Session ${sessionCode}`);
        this.connectionEstablished$.next(true);
        
        // Invoke the JoinSession method on your C# Hub
        this.joinSession(sessionCode);
        this.registerHandlers();
      })
      .catch((err: Error) => {
        console.error('[SignalR] Connection Error: ', err);
        this.connectionEstablished$.next(false);
      });
  }

  private joinSession(sessionCode: string): void {
    this.hubConnection.invoke('JoinSession', sessionCode)
      .catch((err: Error) => console.error('[SignalR] JoinSession Error: ', err));
  }

  /**
   * Registers listeners for server-side broadcasts
   * Matches your NotifyX methods in SessionHub.cs
   */
  private registerHandlers(): void {
    // Matches NotifySurveyStarted
    this.hubConnection.on('SurveyStarted', (data: SurveyData) => {
      this.surveyStarted$.next(data);
    });

    // Matches NotifyNewSurvey
    this.hubConnection.on('ReceiveNewSurvey', (data: SurveyData) => {
      this.newSurveyReceived$.next(data);
    });

    // Matches NotifyParticipantJoined
    this.hubConnection.on('ParticipantJoined', (data: ParticipantData) => {
      this.participantJoined$.next(data);
    });

    // Matches NotifySessionStatusChanged
    this.hubConnection.on('SessionStatusChanged', (data: SessionStatusData) => {
      this.sessionStatusChanged$.next(data);
    });

    // Matches NotifySessionEnded
    this.hubConnection.on('SessionEnded', (data: { sessionId: number; [key: string]: unknown }) => {
      this.sessionEnded$.next(data);
    });

    this.hubConnection.on('ReceiveQuestion', (data: ReceiveQuestionData | number) => {
      if (typeof data === 'number') {
        this.receiveQuestion$.next({ currentQuestion: data });
      } else {
        this.receiveQuestion$.next(data);
      }
    });

    // Leaderboard event handlers
    this.hubConnection.on('LeaderboardUpdated', (data: any) => {
      this.leaderboardUpdated$.next(data);
    });

    this.hubConnection.on('HostLeaderboardUpdated', (data: any) => {
      this.hostLeaderboardUpdated$.next(data);
    });

    this.hubConnection.on('ParticipantCountUpdated', (count: number) => {
      this.participantCountUpdated$.next(count);
    });

    this.hubConnection.on('LeaderboardVisibilityChanged', (isVisible: boolean) => {
      this.leaderboardVisibilityChanged$.next(isVisible);
    });

    this.hubConnection.on('ScoreUpdated', (data: any) => {
      this.scoreUpdated$.next(data);
    });

    this.hubConnection.on('ShowLeaderboard', (data: any) => {
      this.showLeaderboard$.next(data);
    });

    this.hubConnection.on('ShowHostLeaderboard', (data: any) => {
      this.showHostLeaderboard$.next(data);
    });
  }

  /**
   * Hub Invocations (Client to Server)
   */
  public async leaveSession(sessionCode: string): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('LeaveSession', sessionCode);
    }
  }

  public disconnect(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.connectionEstablished$.next(false);
    }
  }

  /**
   * Initialize Leaderboard Hub Connection
   */
  public initLeaderboardHub(sessionId: number): void {
    if (this.leaderboardHubConnection && this.leaderboardConnectionEstablished$.value) {
      console.log('[SignalR] Leaderboard hub already connected');
      return;
    }

    this.leaderboardHubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.signalRUrl}/leaderboardHub`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.leaderboardHubConnection
      .start()
      .then(() => {
        console.log(`[SignalR] Connected to Leaderboard Hub for Session ${sessionId}`);
        this.leaderboardConnectionEstablished$.next(true);
        
        // Join the session leaderboard group
        this.joinSessionLeaderboard(sessionId);
        this.registerLeaderboardHandlers();
      })
      .catch((err: Error) => {
        console.error('[SignalR] Leaderboard Hub Connection Error: ', err);
        this.leaderboardConnectionEstablished$.next(false);
      });

    // Handle reconnection
    this.leaderboardHubConnection.onreconnected(() => {
      console.log('[SignalR] Leaderboard hub reconnected');
      this.leaderboardConnectionEstablished$.next(true);
      this.joinSessionLeaderboard(sessionId);
    });

    this.leaderboardHubConnection.onclose(() => {
      console.log('[SignalR] Leaderboard hub connection closed');
      this.leaderboardConnectionEstablished$.next(false);
    });
  }

  /**
   * Join session leaderboard group
   */
  private joinSessionLeaderboard(sessionId: number): void {
    if (this.leaderboardHubConnection) {
      this.leaderboardHubConnection.invoke('JoinSessionLeaderboard', sessionId)
        .catch((err: Error) => console.error('[SignalR] JoinSessionLeaderboard Error: ', err));
    }
  }

  /**
   * Leave session leaderboard group
   */
  public leaveSessionLeaderboard(sessionId: number): void {
    if (this.leaderboardHubConnection) {
      this.leaderboardHubConnection.invoke('LeaveSessionLeaderboard', sessionId)
        .catch((err: Error) => console.error('[SignalR] LeaveSessionLeaderboard Error: ', err));
    }
  }

  /**
   * Register leaderboard-specific event handlers
   */
  private registerLeaderboardHandlers(): void {
    if (!this.leaderboardHubConnection) return;

    // Leaderboard update events
    this.leaderboardHubConnection.on('LeaderboardUpdated', (data: any) => {
      console.log('[SignalR] LeaderboardUpdated:', data);
      this.leaderboardUpdated$.next(data);
    });

    this.leaderboardHubConnection.on('HostLeaderboardUpdated', (data: any) => {
      console.log('[SignalR] HostLeaderboardUpdated:', data);
      this.hostLeaderboardUpdated$.next(data);
    });

    this.leaderboardHubConnection.on('ParticipantCountUpdated', (count: number) => {
      console.log('[SignalR] ParticipantCountUpdated:', count);
      this.participantCountUpdated$.next(count);
    });

    this.leaderboardHubConnection.on('LeaderboardVisibilityChanged', (isVisible: boolean) => {
      console.log('[SignalR] LeaderboardVisibilityChanged:', isVisible);
      this.leaderboardVisibilityChanged$.next(isVisible);
    });

    this.leaderboardHubConnection.on('ScoreUpdated', (data: any) => {
      console.log('[SignalR] ScoreUpdated:', data);
      this.scoreUpdated$.next(data);
    });

    this.leaderboardHubConnection.on('ShowLeaderboard', (data: any) => {
      console.log('[SignalR] ShowLeaderboard:', data);
      this.showLeaderboard$.next(data);
    });

    this.leaderboardHubConnection.on('ShowHostLeaderboard', (data: any) => {
      console.log('[SignalR] ShowHostLeaderboard:', data);
      this.showHostLeaderboard$.next(data);
    });
  }

  /**
   * Disconnect from Leaderboard Hub
   */
  public disconnectLeaderboardHub(): void {
    if (this.leaderboardHubConnection) {
      this.leaderboardHubConnection.stop();
      this.leaderboardConnectionEstablished$.next(false);
    }
  }
}