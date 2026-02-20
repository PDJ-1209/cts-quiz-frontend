# Angular Frontend: Republish & Schedule Implementation

## Overview
Complete implementation of republish functionality, scheduling, SignalR integration, and countdown timers for polls and surveys in the Angular frontend.

---

## ✅ Completed Features

### 1. **Models & Interfaces** (`models/ipoll.ts`, `models/isurvey.ts`)

#### Poll Models Added:
```typescript
- RepublishPollRequest
- RepublishPollResponse
- SchedulePollRequest
- SchedulePollResponse
- PollOverviewExtended (with qrCodeBase64, countdownDuration, etc.)
```

#### Survey Models Added:
```typescript
- RepublishSurveyRequest
- RepublishSurveyResponse
- ScheduleSurveyRequest
- ScheduleSurveyResponse
- SurveyOverviewExtended (with qrCodeBase64, countdownDuration, etc.)
```

---

### 2. **Services Updated**

#### **PollService** (`services/poll.service.ts`)
New methods:
```typescript
republishPoll(pollId: number, request?: Partial<RepublishPollRequest>): Observable<RepublishPollResponse>
schedulePoll(pollId: number, startTime: Date, endTime?: Date, countdownDuration?: number): Observable<SchedulePollResponse>
```

**Usage:**
```typescript
// Republish
this.pollService.republishPoll(pollId, {
  countdownDurationSeconds: 45
}).subscribe(response => {
  console.log('New session code:', response.newSessionCode);
  console.log('QR Code:', response.qrCodeBase64);
});

// Schedule
this.pollService.schedulePoll(pollId, new Date('2026-02-20T14:00:00Z'), new Date('2026-02-20T15:00:00Z'))
  .subscribe(response => {
    console.log('Scheduled session code:', response.sessionCode);
  });
```

#### **SurveyService** (`services/survey.service.ts`)
New methods:
```typescript
republishSurvey(surveyId: number, request?: Partial<RepublishSurveyRequest>): Observable<RepublishSurveyResponse>
scheduleSurvey(surveyId: number, startTime: Date, endTime?: Date, countdownDuration?: number): Observable<ScheduleSurveyResponse>
```

---

### 3. **SignalR Service Extended** (`services/signalr.service.ts`)

#### New Event Streams:
```typescript
pollStarted$: Subject<PollStartedData>
countdownTick$: Subject<CountdownTickData>
countdownCompleted$: Subject<string>
nextQuestion$: Subject<NextQuestionData>
currentQuestion$: Subject<CurrentQuestionData>
pollCompleted$: Subject<string>
surveyCompleted$: Subject<string>
reconnectedToSession$: Subject<ReconnectedData>
sessionValidationResult$: Subject<SessionValidationData>
```

#### New Hub Methods:
```typescript
joinPollSession(sessionCode: string): Promise<void>
joinSurveySession(sessionCode: string): Promise<void>
validateSessionCode(sessionCode: string): Promise<void>
reconnectToActiveSession(sessionCode: string, participantId: string): Promise<void>
```

#### Event Handlers Registered:
- `PollStarted` - Poll session started
- `SurveyStarted` - Survey session started
- `CountdownTick` - Real-time countdown updates
- `CountdownCompleted` - Countdown finished
- `NextQuestion` - Navigate to next question
- `CurrentQuestion` - Current question info
- `SessionEnded` - Session ended (for republish)
- `PollCompleted` / `SurveyCompleted` - Session completed
- `ReconnectedToSession` - Successful reconnection
- `SessionValidationResult` - Session validation response

---

### 4. **Countdown Timer Component** (`shared/countdown-timer/countdown-timer.component.ts`)

Reusable countdown component with:
- **Real-time synchronization** via SignalR
- **Circular progress** animation
- **Visual warnings** at 10s and 5s remaining
- **Automatic completion** handling
- **Local fallback** if SignalR disconnected

**Usage in Components:**
```html
<app-countdown-timer
  [duration]="45"
  [sessionCode]="sessionCode"
  [questionIndex]="currentQuestionIndex"
  [autoStart]="true"
  [showMessage]="true"
  (countdownComplete)="onCountdownComplete()"
  (tick)="onCountdownTick($event)"
></app-countdown-timer>
```

**Features:**
- ✅ Syncs with backend SignalR countdown ticks
- ✅ Shows remaining seconds with circular progress
- ✅ Color changes: Blue → Orange (10s) → Red (5s)
- ✅ Animations: Pulse (10s), Shake (5s)
- ✅ Emits events on completion and every tick
- ✅ Can be reset, paused, and resumed

---

## 🎯 Component Integration Guide

### Poll Component Implementation

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { PollService } from '../../services/poll.service';
import { SignalrService } from '../../services/signalr.service';
import { Subscription } from 'rxjs';
import { RepublishPollResponse, PollOverview } from '../../models/ipoll';
import { CountdownTimerComponent } from '../../shared/countdown-timer/countdown-timer.component';

@Component({
  selector: 'app-poll-host',
  standalone: true,
  imports: [CommonModule, CountdownTimerComponent],
  template: `
    <div class="poll-host-container">
      <!-- Poll Details -->
      <div class="poll-info" *ngIf="currentPoll">
        <h2>{{ currentPoll.pollTitle }}</h2>
        <p>{{ currentPoll.pollQuestion }}</p>
        <div class="session-info">
          <span class="session-code">Session Code: {{ currentPoll.sessionCode }}</span>
          <span class="status" [class.active]="currentPoll.pollStatus === 'Active'">
            {{ currentPoll.pollStatus }}
          </span>
        </div>
      </div>

      <!-- QR Code Display -->
      <div class="qr-code-section" *ngIf="qrCodeBase64">
        <h3>Scan to Join</h3>
        <img [src]="'data:image/png;base64,' + qrCodeBase64" alt="Session QR Code" />
        <p>Session Code: {{ currentPoll?.sessionCode }}</p>
      </div>

      <!-- Countdown Timer -->
      <app-countdown-timer
        *ngIf="showCountdown"
        [duration]="countdownDuration"
        [sessionCode]="currentPoll?.sessionCode || ''"
        [autoStart]="false"
        (countdownComplete)="onCountdownComplete()"
        (tick)="onCountdownTick($event)"
      ></app-countdown-timer>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn btn-primary" (click)="republishPoll()" [disabled]="loading">
          🔄 Republish Poll
        </button>
        <button class="btn btn-secondary" (click)="openScheduleModal()" [disabled]="loading">
          📅 Schedule Poll
        </button>
      </div>

      <!-- Schedule Form -->
      <div class="schedule-form" *ngIf="showScheduleForm">
        <h3>Schedule Poll</h3>
        <form (ngSubmit)="schedulePoll()">
          <div class="form-group">
            <label>Start Time:</label>
            <input type="datetime-local" [(ngModel)]="scheduleStartTime" required />
          </div>
          <div class="form-group">
            <label>End Time:</label>
            <input type="datetime-local" [(ngModel)]="scheduleEndTime" />
          </div>
          <div class="form-group">
            <label>Countdown Duration (seconds):</label>
            <input type="number" [(ngModel)]="countdownDuration" min="10" max="300" />
          </div>
          <button type="submit" class="btn btn-success">Schedule</button>
          <button type="button" class="btn btn-cancel" (click)="closeScheduleModal()">Cancel</button>
        </form>
      </div>
    </div>
  `
})
export class PollHostComponent implements OnInit, OnDestroy {
  currentPoll?: PollOverview;
  qrCodeBase64?: string;
  showCountdown = false;
  countdownDuration = 45;
  loading = false;
  showScheduleForm = false;
  scheduleStartTime?: string;
  scheduleEndTime?: string;

  private subscriptions: Subscription[] = [];

  constructor(
    private pollService: PollService,
    private signalrService: SignalrService
  ) {}

  ngOnInit(): void {
    // Subscribe to poll started event
    const pollStartedSub = this.signalrService.pollStarted$.subscribe(data => {
      console.log('Poll started:', data);
      this.showCountdown = true;
      this.countdownDuration = data.countdownDuration;
    });

    // Subscribe to countdown completed event
    const countdownCompletedSub = this.signalrService.countdownCompleted$.subscribe(sessionCode => {
      if (sessionCode === this.currentPoll?.sessionCode) {
        this.onCountdownComplete();
      }
    });

    // Subscribe to session ended event
    const sessionEndedSub = this.signalrService.sessionEnded$.subscribe(data => {
      console.log('Session ended:', data);
      alert(data.message || 'Session has ended');
    });

    this.subscriptions.push(pollStartedSub, countdownCompletedSub, sessionEndedSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  republishPoll(): void {
    if (!this.currentPoll) return;

    this.loading = true;
    this.pollService.republishPoll(this.currentPoll.pollId, {
      countdownDurationSeconds: 45
    }).subscribe({
      next: (response: RepublishPollResponse) => {
        console.log('Poll republished:', response);
        
        // Update UI with new session info
        if (this.currentPoll) {
          this.currentPoll.sessionCode = response.newSessionCode;
          this.currentPoll.pollStatus = response.pollStatus;
        }
        this.qrCodeBase64 = response.qrCodeBase64;
        this.countdownDuration = response.countdownDurationSeconds;
        
        alert(`Poll republished! New session code: ${response.newSessionCode}`);
        this.loading = false;
      },
      error: (error) => {
        console.error('Republish failed:', error);
        alert('Failed to republish poll');
        this.loading = false;
      }
    });
  }

  openScheduleModal(): void {
    this.showScheduleForm = true;
  }

  closeScheduleModal(): void {
    this.showScheduleForm = false;
  }

  schedulePoll(): void {
    if (!this.currentPoll || !this.scheduleStartTime) return;

    this.loading = true;
    const startTime = new Date(this.scheduleStartTime);
    const endTime = this.scheduleEndTime ? new Date(this.scheduleEndTime) : undefined;

    this.pollService.schedulePoll(this.currentPoll.pollId, startTime, endTime, this.countdownDuration)
      .subscribe({
        next: (response) => {
          console.log('Poll scheduled:', response);
          alert(`Poll scheduled for ${response.scheduledStartTime}`);
          this.closeScheduleModal();
          this.loading = false;
        },
        error: (error) => {
          console.error('Schedule failed:', error);
          alert('Failed to schedule poll');
          this.loading = false;
        }
      });
  }

  onCountdownComplete(): void {
    console.log('Countdown completed!');
    this.showCountdown = false;
    // Navigate to results or next question
    // this.router.navigate(['/poll/results', this.currentPoll?.pollId]);
  }

  onCountdownTick(seconds: number): void {
    console.log(`${seconds} seconds remaining`);
  }
}
```

---

### Survey Participate Component with Countdown

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SurveyService } from '../../services/survey.service';
import { SignalrService } from '../../services/signalr.service';
import { Subscription } from 'rxjs';
import { SurveyOverview } from '../../models/isurvey';
import { CountdownTimerComponent } from '../../shared/countdown-timer/countdown-timer.component';

@Component({
  selector: 'app-survey-participate',
  standalone: true,
  imports: [CommonModule, CountdownTimerComponent, FormsModule],
  template: `
    <div class="survey-container">
      <!-- Session Validation -->
      <div *ngIf="validating" class="validation-message">
        <p>Validating session...</p>
      </div>

      <!-- Countdown Timer -->
      <app-countdown-timer
        *ngIf="showCountdown && currentQuestion"
        [duration]="countdownDuration"
        [sessionCode]="sessionCode"
        [questionIndex]="currentQuestionIndex"
        (countdownComplete)="onCountdownComplete()"
      ></app-countdown-timer>

      <!-- Current Question -->
      <div class="question-section" *ngIf="currentQuestion">
        <h3>Question {{ currentQuestionIndex + 1 }} of {{ totalQuestions }}</h3>
        <p>{{ currentQuestion.questionText }}</p>
        
        <!-- Answer inputs based on question type -->
        <div [ngSwitch]="currentQuestion.questionType">
          <div *ngSwitchCase="'text'">
            <textarea [(ngModel)]="currentAnswer" placeholder="Your answer..."></textarea>
          </div>
          
          <div *ngSwitchCase="'rating'">
            <div class="rating-buttons">
              <button *ngFor="let star of [1,2,3,4,5]" 
                      (click)="currentAnswer = star"
                      [class.selected]="currentAnswer === star">
                {{ star }}
              </button>
            </div>
          </div>
          
          <div *ngSwitchCase="'multiple_choice'">
            <div *ngFor="let option of currentQuestion.options" class="checkbox-option">
              <label>
                <input type="checkbox" 
                       [checked]="isOptionSelected(option.optionId)"
                       (change)="toggleOption(option.optionId)" />
                {{ option.optionText }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SurveyParticipateComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  survey?: SurveyOverview;
  currentQuestion?: any;
  currentQuestionIndex: number = 0;
  totalQuestions: number = 0;
  currentAnswer: any;
  showCountdown = false;
  countdownDuration = 45;
  validating = true;
  selectedOptions: Set<number> = new Set();

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private signalrService: SignalrService
  ) {}

  ngOnInit(): void {
    this.sessionCode = this.route.snapshot.params['sessionCode'];

    // Validate session before joining
    this.validateAndJoinSession();

    // Subscribe to SignalR events
    this.setupSignalRListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async validateAndJoinSession(): Promise<void> {
    // Connect to SignalR
    this.signalrService.initHubConnection(this.sessionCode);

    // Validate session
    await this.signalrService.validateSessionCode(this.sessionCode);

    // Listen for validation result
    const validationSub = this.signalrService.sessionValidationResult$.subscribe(result => {
      this.validating = false;
      if (result.isValid) {
        console.log('Session is valid, joining...');
        this.joinSession();
      } else {
        alert(`Cannot join session: ${result.message}`);
        this.router.navigate(['/']);
      }
    });

    this.subscriptions.push(validationSub);
  }

  private async joinSession(): Promise<void> {
    await this.signalrService.joinSurveySession(this.sessionCode);
    // Load survey data
    // this.loadSurvey();
  }

  private setupSignalRListeners(): void {
    // Survey started
    const surveyStartedSub = this.signalrService.surveyStarted$.subscribe(data => {
      console.log('Survey started:', data);
      this.showCountdown = true;
      this.countdownDuration = data.countdownDuration;
    });

    // Current question
    const currentQuestionSub = this.signalrService.currentQuestion$.subscribe(data => {
      console.log('Current question:', data);
      this.currentQuestionIndex = data.questionIndex;
      this.totalQuestions = data.totalQuestions;
      this.loadQuestion(data.questionId);
    });

    // Next question
    const nextQuestionSub = this.signalrService.nextQuestion$.subscribe(data => {
      console.log('Next question:', data);
      this.currentQuestionIndex = data.questionIndex;
      this.currentAnswer = null;
      this.selectedOptions.clear();
    });

    // Survey completed
    const surveyCompletedSub = this.signalrService.surveyCompleted$.subscribe(sessionCode => {
      console.log('Survey completed');
      this.router.navigate(['/survey/thank-you']);
    });

    // Reconnection handling
    const reconnectedSub = this.signalrService.reconnectedToSession$.subscribe(data => {
      console.log('Reconnected to session:', data);
    });

    this.subscriptions.push(
      surveyStartedSub,
      currentQuestionSub,
      nextQuestionSub,
      surveyCompletedSub,
      reconnectedSub
    );
  }

  private loadQuestion(questionId: number): void {
    // Load question details from survey
    // this.currentQuestion = ...
  }

  onCountdownComplete(): void {
    console.log('Countdown completed, moving to next question');
    // Backend will automatically trigger NextQuestion event
  }

  isOptionSelected(optionId: number): boolean {
    return this.selectedOptions.has(optionId);
  }

  toggleOption(optionId: number): void {
    if (this.selectedOptions.has(optionId)) {
      this.selectedOptions.delete(optionId);
    } else {
      this.selectedOptions.add(optionId);
    }
  }
}
```

---

## 📋 Integration Checklist

### ✅ Backend Integration Points

1. **Endpoints Available:**
   - `POST /api/Host/Poll/{pollId}/republish`
   - `POST /api/Host/Survey/{surveyId}/republish`
   - `POST /api/Host/Poll/{pollId}/schedule`
   - `POST /api/Host/Survey/{surveyId}/schedule`

2. **SignalR Hub Connected:**
   - Hub URL: `${environment.signalRUrl}` (default: `http://localhost:5000/quizSessionHub`)
   - Connection established on component init
   - Automatic reconnection enabled

3. **Events Subscribed:**
   - ✅ PollStarted / SurveyStarted
   - ✅ CountdownTick (every second)
   - ✅ CountdownCompleted
   - ✅ NextQuestion
   - ✅ CurrentQuestion
   - ✅ SessionEnded
   - ✅ PollCompleted / SurveyCompleted
   - ✅ ReconnectedToSession
   - ✅ SessionValidationResult

---

## 🎨 UI Components Needed

### Components to Create:

1. **Poll Host Dashboard** - With republish and schedule buttons
2. **Survey Host Dashboard** - With republish and schedule buttons
3. **Poll Participate View** - With countdown and validation
4. **Survey Participate View** - With countdown and automatic navigation
5. **Schedule Modal** - For datetime picking
6. **QR Code Display** - For showing QR codes

### Styling Recommendations:

```css
/* Republish Button */
.btn-republish {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-republish:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

/* QR Code Container */
.qr-code-display {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.qr-code-display img {
  max-width: 300px;
  width: 100%;
  height: auto;
}

/* Session Code Badge */
.session-code {
  display: inline-block;
  background: #667eea;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 1.25rem;
  letter-spacing: 2px;
}
```

---

## 🔧 Environment Configuration

Update `environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  signalRUrl: 'http://localhost:5000/quizSessionHub'
};
```

---

## 🚀 Next Steps for Complete Integration

1. **Update Existing Poll/Survey Components:**
   - Add republish button to poll host view
   - Add schedule button to poll host view
   - Integrate countdown timer component
   - Display QR codes after republish

2. **Update Participant Join Flow:**
   - Add session validation before joining
   - Handle inactive session errors
   - Implement reconnection logic

3. **Add Routing:**
   ```typescript
   {
     path: 'poll/:sessionCode',
     component: PollParticipateComponent
   },
   {
     path: 'survey/:sessionCode',
     component: SurveyParticipateComponent
   },
   {
     path: 'survey/thank-you',
     component: ThankYouComponent
   }
   ```

4. **Testing:**
   - Test republish flow with multiple participants
   - Test scheduled start at specific time
   - Test countdown synchronization
   - Test reconnection after disconnect
   - Test session validation

---

## 📚 Documentation Links

- **Backend API Reference:** `cts_quiz_backend/API_QUICK_REFERENCE.md`
- **Testing Guide:** `cts_quiz_backend/TESTING_GUIDE_KAHOOT_LIKE_FEATURES.md`
- **Implementation Summary:** `cts_quiz_backend/REPUBLISH_SCHEDULE_IMPLEMENTATION_SUMMARY.md`

---

## ✨ Key Features Summary

✅ **Republish:** New session codes, QR codes, countdown reset  
✅ **Schedule:** Automatic start at scheduled time  
✅ **Countdown:** Real-time 45-second countdown with visual feedback  
✅ **SignalR:** Full integration with backend events  
✅ **Reconnection:** Seamless reconnection support  
✅ **Validation:** Session validation before joining  
✅ **Navigation:** Automatic question navigation  
✅ **Kahoot-like UX:** Synchronized countdown and progression  

All frontend infrastructure is now in place. Next steps are integrating these services and components into your existing poll and survey views!
