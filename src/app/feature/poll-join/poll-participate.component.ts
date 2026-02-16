import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as signalR from '@microsoft/signalr';
import { PollService } from '../../services/poll.service';
import { PollOverview, PollVoteSubmission } from '../../models/ipoll';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-poll-participate',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './poll-participate.component.html',
  styleUrls: ['./poll-participate.component.css']
})
export class PollParticipateComponent implements OnInit, OnDestroy {
  poll = signal<PollOverview | null>(null);
  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  selectedOptions = signal<number[]>([]);
  participantId = signal<number>(0);
  sessionId = signal<number>(0);
  sessionCode = signal<string>('');
  
  // Timer and synchronization
  timeRemaining = signal<number>(0);
  serverTimeOffsetMs = signal<number>(0);
  startedAtMs = signal<number>(0);
  hasSubmitted = signal<boolean>(false);
  pollEnded = signal<boolean>(false);
  
  private hubConnection?: signalR.HubConnection;
  private timerInterval?: any;
  private hasNavigatedAway = false;
  
  private pollService = inject(PollService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  // Computed properties
  canSubmit = computed(() => 
    this.selectedOptions().length > 0 && 
    !this.submitting() && 
    !this.hasSubmitted() && 
    !this.pollEnded()
  );

  ngOnInit(): void {
    this.loadSessionData();
    this.loadPoll();
    this.initializeSignalR();
    this.startTimer();
    
    // Prevent back navigation
    history.pushState(null, '', location.href);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    if (!this.hasSubmitted() && !this.pollEnded()) {
      const confirmed = confirm('Are you sure you want to leave? Your vote will not be submitted.');
      if (!confirmed) {
        history.pushState(null, '', location.href);
        return;
      }
    }
    this.cleanup();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden && this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      // Refresh session sync when page becomes visible
      this.refreshSessionSync();
    }
  }

  private loadSessionData(): void {
    // Load from query params first
    this.route.queryParams.subscribe(params => {
      if (params['sessionCode']) {
        this.sessionCode.set(params['sessionCode']);
        localStorage.setItem('sessionCode', params['sessionCode']);
      }
      if (params['participantId']) {
        this.participantId.set(+params['participantId']);
        localStorage.setItem('participantId', params['participantId']);
      }
      if (params['pollId']) {
        localStorage.setItem('pollId', params['pollId']);
      }
    });

    // Load from route params or localStorage
    this.route.params.subscribe(params => {
      const sessionId = params['sessionId'];
      if (sessionId) {
        this.sessionId.set(parseInt(sessionId));
      } else {
        const storedSessionId = localStorage.getItem('sessionId') || localStorage.getItem('pollSessionId');
        if (storedSessionId) {
          this.sessionId.set(parseInt(storedSessionId));
        }
      }
    });

    // Load other data from localStorage
    if (!this.participantId()) {
      const participantIdStr = localStorage.getItem('participantId');
      if (participantIdStr) {
        this.participantId.set(parseInt(participantIdStr));
      }
    }

    if (!this.sessionCode()) {
      const storedCode = localStorage.getItem('sessionCode');
      if (storedCode) {
        this.sessionCode.set(storedCode);
      }
    }
  }

  private loadPoll(): void {
    const sessionId = this.sessionId();
    if (!sessionId) {
      this.snackBar.open('No poll session found', 'Close', { duration: 3000 });
      this.router.navigate(['/lobby']);
      return;
    }

    this.loading.set(true);
    this.pollService.getParticipantPollBySession(sessionId).subscribe({
      next: (poll) => {
        this.poll.set(poll);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading poll:', error);
        this.snackBar.open('Failed to load poll', 'Close', { duration: 3000 });
        this.loading.set(false);
        this.router.navigate(['/lobby']);
      }
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

      // Listen for session sync (server time synchronization)
      this.hubConnection.on('SessionSync', (data: any) => {
        console.log('SessionSync received:', data);
        const serverNowMs = new Date(data.serverNow || data.ServerNow).getTime();
        const clientNowMs = Date.now();
        this.serverTimeOffsetMs.set(serverNowMs - clientNowMs);
        
        if (data.startedAt || data.StartedAt) {
          this.startedAtMs.set(new Date(data.startedAt || data.StartedAt).getTime());
        }
      });

      // Listen for poll republish event
      this.hubConnection.on('PollRepublished', (data: any) => {
        console.log('Poll republished event received:', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.snackBar.open('Poll has been restarted!', 'Close', { duration: 2000 });
          this.hasSubmitted.set(false);
          this.pollEnded.set(false);
          this.loadPoll();
        }
      });

      // Listen for poll ended event
      this.hubConnection.on('PollEnded', (data: any) => {
        console.log('Poll ended event received:', data);
        const sessionCode = this.sessionCode();
        if (data.sessionCode === sessionCode || data.SessionCode === sessionCode) {
          this.handlePollEnd();
        }
      });

      await this.hubConnection.start();
      console.log('SignalR connected for poll participation');

      // Join the session
      const sessionCode = this.sessionCode();
      if (sessionCode) {
        await this.hubConnection.invoke('JoinSession', sessionCode);
        console.log(`Joined poll session: ${sessionCode}`);
      }

      // Request initial session sync
      await this.refreshSessionSync();
    } catch (error) {
      console.error('SignalR connection error:', error);
    }
  }

  private async refreshSessionSync(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        const sessionCode = this.sessionCode();
        if (sessionCode) {
          await this.hubConnection.invoke('RequestSessionSync', sessionCode);
        }
      } catch (error) {
        console.error('Error requesting session sync:', error);
      }
    }
  }

  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  private updateTimer(): void {
    // Polls don't have time limits - they remain open until host closes them
    // Timer is only used for display purposes if needed
  }

  private handleTimeExpiry(): void {
    this.pollEnded.set(true);
    this.snackBar.open('Time expired! Poll has ended.', 'Close', { duration: 3000 });
    
    // Auto-submit if options selected
    if (this.selectedOptions().length > 0) {
      this.submitVote(true);
    } else {
      setTimeout(() => {
        this.navigateToResults();
      }, 2000);
    }
  }

  private handlePollEnd(): void {
    this.pollEnded.set(true);
    this.snackBar.open('Poll has ended by host', 'Close', { duration: 3000 });
    
    setTimeout(() => {
      this.navigateToResults();
    }, 2000);
  }

  toggleOption(optionId: number): void {
    if (this.hasSubmitted() || this.pollEnded()) return;
    
    const poll = this.poll();
    if (!poll) return;

    const currentSelected = this.selectedOptions();
    
    if (poll.selectionType === 'single') {
      this.selectedOptions.set([optionId]);
    } else {
      const index = currentSelected.indexOf(optionId);
      if (index > -1) {
        this.selectedOptions.set(currentSelected.filter(id => id !== optionId));
      } else {
        this.selectedOptions.set([...currentSelected, optionId]);
      }
    }
  }

  isSelected(optionId: number): boolean {
    return this.selectedOptions().includes(optionId);
  }

  submitVote(isAutoSubmit: boolean = false): void {
    if (!this.canSubmit() && !isAutoSubmit) return;
    
    const poll = this.poll();
    const sessionId = this.sessionId();
    const participantId = this.participantId();
    
    if (!poll || !sessionId || !participantId) return;

    this.submitting.set(true);

    const vote: PollVoteSubmission = {
      pollId: poll.pollId,
      participantId: participantId,
      optionId: this.selectedOptions()[0], // For interface compatibility
      selectedOptionIds: this.selectedOptions(),
      interactionValue: 1
    };

    this.pollService.submitPollVote(vote).subscribe({
      next: () => {
        this.hasSubmitted.set(true);
        this.submitting.set(false);
        
        const message = isAutoSubmit 
          ? 'Vote auto-submitted (time expired)' 
          : 'Vote submitted successfully!';
        
        this.snackBar.open(message, 'Close', { duration: 3000 });
        
        setTimeout(() => {
          this.navigateToResults();
        }, 1500);
      },
      error: (error) => {
        console.error('Error submitting vote:', error);
        this.snackBar.open(
          error.error?.message || 'Failed to submit vote. Please try again.', 
          'Close', 
          { duration: 3000 }
        );
        this.submitting.set(false);
      }
    });
  }

  private async navigateToResults(): Promise<void> {
    this.hasNavigatedAway = true;
    
    // Leave session before navigating
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        const sessionCode = this.sessionCode();
        if (sessionCode) {
          await this.hubConnection.invoke('LeaveSession', sessionCode);
        }
      } catch (error) {
        console.error('Error leaving session:', error);
      }
    }

    this.cleanup();
    this.router.navigate(['/participant']);
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
