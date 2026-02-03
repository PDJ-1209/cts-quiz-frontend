import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

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
  
  // Connection state
  public connectionEstablished$ = new BehaviorSubject<boolean>(false);

  constructor() {}

  /**
   * Initializes connection and joins the specific session group
   */
  public initHubConnection(sessionId: number, participantId: number): void {
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
        console.log(`[SignalR] Connected to Hub for Session ${sessionId}`);
        this.connectionEstablished$.next(true);
        
        // Invoke the JoinSession method on your C# Hub
        this.joinSession(sessionId, participantId);
        this.registerHandlers();
      })
      .catch((err: Error) => {
        console.error('[SignalR] Connection Error: ', err);
        this.connectionEstablished$.next(false);
      });
  }

  private joinSession(sessionId: number, participantId: number): void {
    this.hubConnection.invoke('JoinSession', sessionId, participantId)
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
  }

  /**
   * Hub Invocations (Client to Server)
   */
  public async leaveSession(sessionId: string): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.invoke('LeaveSessionGroup', sessionId);
    }
  }

  public disconnect(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
      this.connectionEstablished$.next(false);
    }
  }
}