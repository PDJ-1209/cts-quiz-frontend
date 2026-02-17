import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

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
    console.log('[SurveyCountdown] checkIfLate - Time difference (minutes):', (timeDiff / 60000).toFixed(2));
    console.log('[SurveyCountdown] checkIfLate - Session status:', sessionStatus);

    // ±2 minute window for on-time join
    const twoMinutesInMs = 2 * 60 * 1000;
    
    // LATE: More than 2 minutes after start time
    if (timeDiff < -twoMinutesInMs) {
      console.log('[SurveyCountdown] LATE ENTRY BLOCKED - More than 2 minutes late');
      this.isLate.set(true);
      this.snackBar.open('Survey has already started. Late entry not allowed.', 'Close', { duration: 5000 });
      return;
    }
    
    // ON-TIME: Within ±2 minutes of start time - navigate immediately
    if (timeDiff >= -twoMinutesInMs && timeDiff <= twoMinutesInMs) {
      console.log('[SurveyCountdown] ON-TIME entry (within ±2 minutes), navigating immediately');
      this.navigateToSurvey();
      return;
    }
    
    // EARLY: More than 2 minutes before start time - show waiting room
    if (timeDiff > twoMinutesInMs) {
      console.log('[SurveyCountdown] EARLY entry - showing waiting room with countdown');
      // Continue to show waiting room (handled by template)
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
    const twoMinutesInMs = 2 * 60 * 1000;

    // Check if we've entered the on-time window (±2 minutes)
    if (timeDiff <= twoMinutesInMs && timeDiff >= -twoMinutesInMs) {
      console.log('[SurveyCountdown] Countdown reached on-time window, navigating to survey');
      this.hasStarted.set(true);
      this.timeUntilStart.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      this.navigateToSurvey();
      return;
    }

    // Check if we're too late (more than 2 minutes after start)
    if (timeDiff < -twoMinutesInMs) {
      console.log('[SurveyCountdown] Too late - more than 2 minutes after start');
      this.isLate.set(true);
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
      }
      return;
    }

    // Calculate time remaining (for early joiners)
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
