import { Component, OnDestroy, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import * as signalR from '@microsoft/signalr';

interface SessionData {
  sessionId: number;
  quizId: number;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  status: string;
}

@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './countdown.component.html',
  styleUrls: ['./countdown.component.css']
})
export class CountdownComponent implements OnInit, OnDestroy {
  sessionData: SessionData | null = null;
  participantName: string = '';
  sessionCode: string = '';
  
  quizStartTime: Date | null = null;
  quizEndTime: Date | null = null;
  
  timeUntilStart = signal({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  isWaiting = signal(true);
  hasStarted = signal(false);
  lastBackWarnAt: number = 0;

  private intervalId?: number;
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  
  private hubConnection?: signalR.HubConnection;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load session data from localStorage
    const sessionDataStr = localStorage.getItem('sessionData');
    const participantNameStr = localStorage.getItem('participantName');
    
    if (!sessionDataStr) {
      this.snackBar.open('No session data found. Please join a quiz first.', 'Close', { duration: 3000 });
      this.router.navigate(['/participant']);
      return;
    }

    this.sessionData = JSON.parse(sessionDataStr);
    this.participantName = participantNameStr || 'Participant';
    
    // Get session code from query params
    this.route.queryParams.subscribe(params => {
      this.sessionCode = params['code'] || '';
    });

    if (this.sessionData) {
      console.log('[Countdown] Session data:', this.sessionData);
      
      // Parse dates with validation
      if (this.sessionData.startedAt) {
        const startDate = new Date(this.sessionData.startedAt);
        if (!isNaN(startDate.getTime())) {
          this.quizStartTime = startDate;
          console.log('[Countdown] Valid start time:', this.quizStartTime);
        } else {
          console.error('[Countdown] Invalid startedAt date:', this.sessionData.startedAt);
          this.snackBar.open('Invalid quiz start time. Please contact the host.', 'Close', { duration: 5000 });
        }
      } else {
        console.warn('[Countdown] No startedAt in session data');
      }
      
      if (this.sessionData.endedAt) {
        const endDate = new Date(this.sessionData.endedAt);
        if (!isNaN(endDate.getTime())) {
          this.quizEndTime = endDate;
          console.log('[Countdown] Valid end time:', this.quizEndTime);
        } else {
          console.error('[Countdown] Invalid endedAt date:', this.sessionData.endedAt);
        }
      } else {
        console.warn('[Countdown] No endedAt in session data');
      }
      
      // Check if quiz has a valid start time and if it's in the future
      // Only check if quiz has started if there's a future start time
      if (this.quizStartTime) {
        const now = new Date();
        const timeDiff = this.quizStartTime.getTime() - now.getTime();
        
        // Only consider quiz as "already started" if start time is more than 5 seconds in the past
        // This prevents treating newly created sessions as "already started"
        if (timeDiff < -5000) {
          console.log('[Countdown] Quiz already started, navigating to quiz');
          this.hasStarted.set(true);
          this.isWaiting.set(false);
          this.navigateToQuiz();
        } else if (timeDiff < 0) {
          // If within 5 seconds, treat as starting now
          console.log('[Countdown] Quiz starting now');
          this.hasStarted.set(true);
          this.isWaiting.set(false);
          this.navigateToQuiz();
        } else {
          // Start countdown timer for future start time
          console.log('[Countdown] Waiting for quiz to start');
          this.startCountdown();
          
          // Initialize SignalR connection
          this.initializeSignalR();
        }
      } else {
        // No start time set - wait for host to start via SignalR
        console.log('[Countdown] No start time set, waiting for host to start quiz');
        this.initializeSignalR();
      }
    }
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.lockBackNavigation();

    const now = Date.now();
    if (now - this.lastBackWarnAt > 2000) {
      this.lastBackWarnAt = now;
      this.snackBar.open('Back navigation is disabled while waiting for the quiz.', 'Close', { duration: 2000 });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    event.preventDefault();
    event.returnValue = '';
  }

  private lockBackNavigation(): void {
    window.history.pushState(null, '', window.location.href);
  }

  private initializeSignalR(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5195/quizSessionHub', {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('QuizStarted', (sessionCode: string) => {
      console.log('Quiz started notification received for session:', sessionCode);
      this.hasStarted.set(true);
      this.isWaiting.set(false);
      this.stopCountdown();
      this.snackBar.open('Quiz is starting now!', 'Close', { duration: 2000 });
      setTimeout(() => this.navigateToQuiz(), 1000);
    });

    this.hubConnection.start()
      .then(() => {
        console.log('SignalR Connected');
        if (this.sessionCode) {
          this.hubConnection?.invoke('JoinSession', this.sessionCode);
        }
      })
      .catch((err: any) => console.error('Error connecting to SignalR:', err));
  }

  private startCountdown(): void {
    this.updateTimeRemaining();
    
    this.intervalId = setInterval(() => {
      this.updateTimeRemaining();
      
      if (this.quizStartTime && new Date() >= this.quizStartTime) {
        this.hasStarted.set(true);
        this.isWaiting.set(false);
        this.stopCountdown();
        this.navigateToQuiz();
      }
    }, 1000) as unknown as number;
  }

  private updateTimeRemaining(): void {
    if (!this.quizStartTime) return;

    const now = new Date();
    const diff = this.quizStartTime.getTime() - now.getTime();

    if (diff <= 0) {
      this.timeUntilStart.set({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    this.timeUntilStart.set({ days, hours, minutes, seconds });
  }

  private stopCountdown(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private navigateToQuiz(): void {
    this.router.navigate(['/quiz']);
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    
    if (this.hubConnection) {
      if (this.sessionCode) {
        this.hubConnection.invoke('LeaveSession', this.sessionCode);
      }
      this.hubConnection.stop();
    }
  }

  get formattedStartTime(): string {
    if (!this.quizStartTime || isNaN(this.quizStartTime.getTime())) return 'Not set';
    return this.quizStartTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  get formattedEndTime(): string {
    if (!this.quizEndTime || isNaN(this.quizEndTime.getTime())) return 'Not set';
    return this.quizEndTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  get formattedStartDate(): string {
    if (!this.quizStartTime || isNaN(this.quizStartTime.getTime())) return 'Not set';
    return this.quizStartTime.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  get progress(): number {
    if (!this.quizStartTime || !this.sessionData) return 0;
    
    const now = new Date();
    const start = this.quizStartTime;
    const totalWaitTime = start.getTime() - now.getTime();
    
    if (totalWaitTime <= 0) return 100;
    
    // Calculate progress based on time remaining
    const maxWaitTime = 60 * 60 * 1000; // 1 hour max for progress calculation
    const progress = Math.min(100, ((maxWaitTime - totalWaitTime) / maxWaitTime) * 100);
    
    return Math.max(0, progress);
  }
}
