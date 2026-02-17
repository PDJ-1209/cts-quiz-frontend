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
  selector: 'app-poll-countdown',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, MatIconModule],
  templateUrl: './poll-countdown.component.html',
  styleUrls: ['./poll-countdown.component.css']
})
export class PollCountdownComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  pollTitle = signal<string>('');
  pollDescription = signal<string>('');
  participantName = signal<string>('');
  sessionCode = signal<string>('');
  timeUntilStart = signal<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  pollStartTime = signal<Date | null>(null);
  isLate = signal<boolean>(false);
  hasStarted = signal<boolean>(false);
  
  private countdownInterval?: any;
  private hubConnection?: signalR.HubConnection;
  private sessionId?: number;
  private pollId?: number;

  ngOnInit(): void {
    this.loadSessionData();
    
    // Check if session is already active (not scheduled anymore)
    const sessionStatus = localStorage.getItem('sessionStatus');
    if (sessionStatus?.toLowerCase() === 'active') {
      console.log('[PollCountdown] Session is already active, navigating immediately');
      this.navigateToPoll();
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
    // Load poll session data from localStorage
    const pollTitleStored = localStorage.getItem('pollTitle');
    const participantNameStored = localStorage.getItem('participantName');
    const sessionCodeStored = localStorage.getItem('sessionCode');
    const startTimeStored = localStorage.getItem('startTime');
    const sessionIdStored = localStorage.getItem('sessionId');
    const pollIdStored = localStorage.getItem('pollId');

    if (!pollTitleStored || !startTimeStored || !sessionCodeStored) {
      this.snackBar.open('Session data not found. Please rejoin.', 'Close', { duration: 3000 });
      this.router.navigate(['/lobby']);
      return;
    }

    this.pollTitle.set(pollTitleStored);
    this.participantName.set(participantNameStored || 'Participant');
    this.sessionCode.set(sessionCodeStored);
    this.pollStartTime.set(new Date(startTimeStored));
    
    if (sessionIdStored) this.sessionId = parseInt(sessionIdStored);
    if (pollIdStored) this.pollId = parseInt(pollIdStored);

    // Check if we're already late
    this.checkIfLate();
  }

  private checkIfLate(): void {
    const startTime = this.pollStartTime();
    if (!startTime) return;

    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const sessionStatus = localStorage.getItem('sessionStatus')?.toLowerCase();

    console.log('[PollCountdown] checkIfLate - Start time:', startTime);
    console.log('[PollCountdown] checkIfLate - Current time:', now);
    console.log('[PollCountdown] checkIfLate - Time difference (ms):', timeDiff);
    console.log('[PollCountdown] checkIfLate - Time difference (minutes):', (timeDiff / 60000).toFixed(2));
    console.log('[PollCountdown] checkIfLate - Session status:', sessionStatus);

    // ±2 minute window for on-time join
    const twoMinutesInMs = 2 * 60 * 1000;
    
    // LATE: More than 2 minutes after start time
    if (timeDiff < -twoMinutesInMs) {
      console.log('[PollCountdown] LATE ENTRY BLOCKED - More than 2 minutes late');
      this.isLate.set(true);
      this.snackBar.open('Poll has already started. Late entry not allowed.', 'Close', { duration: 5000 });
      return;
    }
    
    // ON-TIME: Within ±2 minutes of start time - navigate immediately
    if (timeDiff >= -twoMinutesInMs && timeDiff <= twoMinutesInMs) {
      console.log('[PollCountdown] ON-TIME entry (within ±2 minutes), navigating immediately');
      this.navigateToPoll();
      return;
    }
    
    // EARLY: More than 2 minutes before start time - show waiting room
    if (timeDiff > twoMinutesInMs) {
      console.log('[PollCountdown] EARLY entry - showing waiting room with countdown');
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
    const startTime = this.pollStartTime();
    if (!startTime) return;

    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const twoMinutesInMs = 2 * 60 * 1000;

    // Check if we've entered the on-time window (±2 minutes)
    if (timeDiff <= twoMinutesInMs && timeDiff >= -twoMinutesInMs) {
      console.log('[PollCountdown] Countdown reached on-time window, navigating to poll');
      this.hasStarted.set(true);
      this.timeUntilStart.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      this.navigateToPoll();
      return;
    }

    // Check if we're too late (more than 2 minutes after start)
    if (timeDiff < -twoMinutesInMs) {
      console.log('[PollCountdown] Too late - more than 2 minutes after start');
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

      // Listen for poll publish event (host manually starts poll)
      this.hubConnection.on('PollPublished', (data: any) => {
        console.log('Poll published event received:', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Poll is starting now!', 'Close', { duration: 2000 });
          this.navigateToPoll();
        }
      });

      // Listen for scheduled poll start event (automatic start at scheduled time)
      this.hubConnection.on('PollStarted', (data: any) => {
        console.log('Poll started event received (scheduled):', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Poll is starting now!', 'Close', { duration: 2000 });
          this.navigateToPoll();
        }
      });

      // Listen for poll republish event
      this.hubConnection.on('PollRepublished', (data: any) => {
        console.log('Poll republished event received:', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Poll has been restarted!', 'Close', { duration: 2000 });
          this.navigateToPoll();
        }
      });

      await this.hubConnection.start();
      console.log('SignalR connected for poll countdown');

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

  private async navigateToPoll(): Promise<void> {
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

    this.router.navigate(['/poll-join']);
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
