import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

@Component({
  selector: 'app-survey-countdown',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, MatIconModule],
  templateUrl: './survey-countdown.component.html',
  styleUrls: ['./survey-countdown.component.css']
})
export class SurveyCountdownComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  surveyTitle = signal<string>('');
  surveyDescription = signal<string>('');
  participantName = signal<string>('');
  sessionCode = signal<string>('');
  timeUntilStart = signal<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  surveyStartTime = signal<Date | null>(null);
  isLate = signal<boolean>(false);
  hasStarted = signal<boolean>(false);
  
  private countdownInterval?: any;
  private hubConnection?: signalR.HubConnection;
  private sessionId?: number;
  private surveyId?: number;

  ngOnInit(): void {
    this.loadSessionData();
    
    // Check if session is already active (not scheduled anymore)
    const sessionStatus = localStorage.getItem('sessionStatus');
    if (sessionStatus?.toLowerCase() === 'active') {
      console.log('[SurveyCountdown] Session is already active, navigating immediately');
      this.navigateToSurvey();
      return;
    }
    
    // Only proceed if we have valid session data
    if (!this.isLate() && this.sessionCode()) {
      this.startCountdown();
      this.initializeSignalR();
    }
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }

  private loadSessionData(): void {
    // Load survey session data from localStorage
    const surveyTitleStored = localStorage.getItem('surveyTitle') || localStorage.getItem('title');
    const participantNameStored = localStorage.getItem('participantName');
    const sessionCodeStored = localStorage.getItem('sessionCode');
    const startTimeStored = localStorage.getItem('startTime');
    const sessionIdStored = localStorage.getItem('sessionId');
    const surveyIdStored = localStorage.getItem('surveyId');

    if (!surveyTitleStored || !startTimeStored || !sessionCodeStored) {
      this.snackBar.open('Session data not found. Please rejoin.', 'Close', { duration: 3000 });
      this.router.navigate(['/lobby']);
      return;
    }

    this.surveyTitle.set(surveyTitleStored);
    this.participantName.set(participantNameStored || 'Participant');
    this.sessionCode.set(sessionCodeStored);
    
    // Debug: Log the raw startTime and parsed date
    console.log('[SurveyCountdown] ===== LOADING SESSION DATA =====');
    console.log('[SurveyCountdown] Raw startTime from localStorage:', startTimeStored);
    console.log('[SurveyCountdown] Session status:', localStorage.getItem('sessionStatus'));
    
    const parsedStartTime = new Date(startTimeStored);
    console.log('[SurveyCountdown] Parsed startTime:', parsedStartTime);
    console.log('[SurveyCountdown] Parsed startTime (ISO):', parsedStartTime.toISOString());
    console.log('[SurveyCountdown] Parsed startTime (Local):', parsedStartTime.toLocaleString());
    console.log('[SurveyCountdown] Current time:', new Date());
    console.log('[SurveyCountdown] Current time (ISO):', new Date().toISOString());
    console.log('[SurveyCountdown] Time difference (ms):', parsedStartTime.getTime() - new Date().getTime());
    console.log('[SurveyCountdown] Time difference (minutes):', ((parsedStartTime.getTime() - new Date().getTime()) / 60000).toFixed(2));
    console.log('[SurveyCountdown] =============================');
    
    this.surveyStartTime.set(parsedStartTime);
    
    if (sessionIdStored) this.sessionId = parseInt(sessionIdStored);
    if (surveyIdStored) this.surveyId = parseInt(surveyIdStored);

    // Check if we're already late
    this.checkIfLate();
  }

  private checkIfLate(): void {
    const startTime = this.surveyStartTime();
    if (!startTime) return;

    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const sessionStatus = localStorage.getItem('sessionStatus')?.toLowerCase();

    console.log('[SurveyCountdown] checkIfLate - Start time:', startTime);
    console.log('[SurveyCountdown] checkIfLate - Current time:', now);
    console.log('[SurveyCountdown] checkIfLate - Time difference (ms):', timeDiff);
    console.log('[SurveyCountdown] checkIfLate - Time difference (seconds):', timeDiff / 1000);
    console.log('[SurveyCountdown] checkIfLate - Session status:', sessionStatus);

    // If survey should have started (within grace period), navigate immediately
    // For scheduled sessions, use 60-second grace period to account for delays
    // For active sessions, use 5-second grace period
    const gracePeriodMs = sessionStatus === 'scheduled' ? -60000 : -5000;
    
    if (timeDiff <= 0 && timeDiff > gracePeriodMs) {
      console.log('[SurveyCountdown] Survey start time reached, navigating immediately');
      this.navigateToSurvey();
      return;
    }

    // Only block entry if truly late (beyond grace period) for ACTIVE sessions
    // For SCHEDULED sessions, wait for SignalR event instead of blocking
    if (timeDiff < gracePeriodMs && sessionStatus === 'active') {
      console.log('[SurveyCountdown] LATE ENTRY BLOCKED - timeDiff:', timeDiff);
      this.isLate.set(true);
      this.snackBar.open('Survey has already started. Late entry not allowed.', 'Close', { duration: 5000 });
    } else if (timeDiff < gracePeriodMs && sessionStatus === 'scheduled') {
      console.log('[SurveyCountdown] Scheduled session time passed, waiting for SignalR SurveyStarted event');
      // Don't block - wait for backend to send SurveyStarted via SignalR
    } else {
      console.log('[SurveyCountdown] Entry allowed - waiting for start time');
    }
  }

  private startCountdown(): void {
    this.updateCountdown();
    
    this.countdownInterval = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  private updateCountdown(): void {
    const startTime = this.surveyStartTime();
    if (!startTime) return;

    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const sessionStatus = localStorage.getItem('sessionStatus')?.toLowerCase();

    if (timeDiff <= 0) {
      // Survey has started
      this.hasStarted.set(true);
      this.timeUntilStart.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      
      // Use appropriate grace period based on session status
      const gracePeriodMs = sessionStatus === 'scheduled' ? -60000 : -5000;
      
      // Check if we're not too late
      if (timeDiff > gracePeriodMs) {
        // Navigate to survey within grace period
        this.navigateToSurvey();
      } else if (sessionStatus === 'active') {
        this.isLate.set(true);
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
        }
      }
      return;
    }

    // Calculate time remaining
    const seconds = Math.floor(timeDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    this.timeUntilStart.set({
      days: days,
      hours: hours % 24,
      minutes: minutes % 60,
      seconds: seconds % 60
    });
  }

  private async initializeSignalR(): Promise<void> {
    try {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(environment.signalRUrl, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect()
        .build();

      // Listen for survey publish event (host manually starts survey)
      this.hubConnection.on('SurveyPublished', (data: any) => {
        console.log('Survey published event received:', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Survey is starting now!', 'Close', { duration: 2000 });
          this.navigateToSurvey();
        }
      });

      // Listen for scheduled survey start event (automatic start at scheduled time)
      this.hubConnection.on('SurveyStarted', (data: any) => {
        console.log('Survey started event received (scheduled):', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Survey is starting now!', 'Close', { duration: 2000 });
          this.navigateToSurvey();
        }
      });

      // Listen for survey republish event
      this.hubConnection.on('SurveyRepublished', (data: any) => {
        console.log('Survey republished event received:', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Survey has been restarted!', 'Close', { duration: 2000 });
          this.navigateToSurvey();
        }
      });

      await this.hubConnection.start();
      console.log('SignalR connected for survey countdown');

      // Join the session
      const sessionCode = this.sessionCode();
      if (sessionCode) {
        await this.hubConnection.invoke('JoinSession', sessionCode);
        console.log(`Joined session: ${sessionCode}`);
      }
    } catch (error) {
      console.error('SignalR connection error:', error);
    }
  }

  private async navigateToSurvey(): Promise<void> {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Leave session before navigating
    if (this.hubConnection) {
      try {
        const sessionCode = this.sessionCode();
        if (sessionCode) {
          await this.hubConnection.invoke('LeaveSession', sessionCode);
        }
      } catch (error) {
        console.error('Error leaving session:', error);
      }
    }

    this.router.navigate(['/survey-participate']);
  }

  returnToLobby(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    // Clean up SignalR
    if (this.hubConnection) {
      this.hubConnection.stop();
    }

    this.router.navigate(['/lobby']);
  }
}
