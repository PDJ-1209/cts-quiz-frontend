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
    console.log('[PollCountdown] checkIfLate - Time difference (seconds):', timeDiff / 1000);
    console.log('[PollCountdown] checkIfLate - Session status:', sessionStatus);

    // If poll should have started (within grace period), navigate immediately
    // For scheduled sessions, use 60-second grace period to account for delays
    // For active sessions, use 5-second grace period
    const gracePeriodMs = sessionStatus === 'scheduled' ? -60000 : -5000;
    
    if (timeDiff <= 0 && timeDiff > gracePeriodMs) {
      console.log('[PollCountdown] Poll start time reached, navigating immediately');
      this.navigateToPoll();
      return;
    }

    // Only block entry if truly late (beyond grace period) for ACTIVE sessions
    // For SCHEDULED sessions, wait for SignalR event instead of blocking
    if (timeDiff < gracePeriodMs && sessionStatus === 'active') {
      console.log('[PollCountdown] LATE ENTRY BLOCKED - timeDiff:', timeDiff);
      this.isLate.set(true);
      this.snackBar.open('Poll has already started. Late entry not allowed.', 'Close', { duration: 5000 });
    } else if (timeDiff < gracePeriodMs && sessionStatus === 'scheduled') {
      console.log('[PollCountdown] Scheduled session time passed, waiting for SignalR PollStarted event');
      // Don't block - wait for backend to send PollStarted via SignalR
    } else {
      console.log('[PollCountdown] Entry allowed - waiting for start time');
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
    const sessionStatus = localStorage.getItem('sessionStatus')?.toLowerCase();

    if (timeDiff <= 0) {
      // Poll has started
      this.hasStarted.set(true);
      this.timeUntilStart.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      
      // Use appropriate grace period based on session status
      const gracePeriodMs = sessionStatus === 'scheduled' ? -60000 : -5000;
      
      // Check if we're not too late
      if (timeDiff > gracePeriodMs) {
        // Navigate to poll within grace period
        this.navigateToPoll();
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
