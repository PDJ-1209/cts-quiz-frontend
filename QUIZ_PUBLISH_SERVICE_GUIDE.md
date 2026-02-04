# Quiz Publish Service Documentation

## Overview
The `QuizPublishService` is a dedicated SignalR service for real-time quiz publishing and management. It enables hosts to publish quizzes, manage quiz sessions, and receive real-time updates about participant activity.

## Features

### ✅ Core Functionality
- **Publish/Unpublish Quizzes** - Make quizzes live or revert to draft
- **Start/End Quiz Sessions** - Control when participants can access quizzes
- **Real-time Participant Tracking** - Know when participants join
- **Quiz Status Management** - Track DRAFT → LIVE → COMPLETED lifecycle
- **Broadcast Messages** - Send messages to all quiz participants
- **Auto-reconnection** - Automatic reconnection with exponential backoff
- **Connection State Management** - Track connection status

---

## Installation & Setup

### 1. Import the Service
```typescript
import { QuizPublishService } from './services/quiz-publish.service';
```

### 2. Inject in Component
```typescript
export class YourComponent {
  constructor(private quizPublishService: QuizPublishService) {}
}
```

### 3. Initialize Connection
```typescript
async ngOnInit() {
  const hostId = '2463579'; // Your host ID
  await this.quizPublishService.initializeConnection(hostId);
}
```

---

## Usage Examples

### 📤 Publishing a Quiz

```typescript
async publishQuiz(quizId: number, quizNumber: string) {
  try {
    // Publish immediately
    await this.quizPublishService.publishQuiz(quizId, quizNumber);
    console.log('Quiz published successfully!');
  } catch (error) {
    console.error('Failed to publish quiz:', error);
  }
}

// With scheduled time
async publishScheduledQuiz(quizId: number, quizNumber: string) {
  const scheduledTime = '2026-02-10T14:00:00Z';
  await this.quizPublishService.publishQuiz(quizId, quizNumber, scheduledTime);
}
```

### 🔄 Republishing a Quiz

```typescript
async republishQuiz(quizId: number, quizNumber: string) {
  try {
    // First unpublish, then publish again
    await this.quizPublishService.unpublishQuiz(quizId, quizNumber);
    await this.quizPublishService.publishQuiz(quizId, quizNumber);
  } catch (error) {
    console.error('Failed to republish:', error);
  }
}
```

### ▶️ Starting a Quiz Session

```typescript
async startQuiz(quizNumber: string) {
  try {
    await this.quizPublishService.startQuizSession(quizNumber);
    console.log('Quiz session started!');
  } catch (error) {
    console.error('Failed to start quiz:', error);
  }
}
```

### ⏹️ Ending a Quiz Session

```typescript
async endQuiz(quizNumber: string) {
  try {
    await this.quizPublishService.endQuizSession(quizNumber);
    console.log('Quiz session ended!');
  } catch (error) {
    console.error('Failed to end quiz:', error);
  }
}
```

### ✅ Completing a Quiz

```typescript
async completeQuiz(quizId: number, quizNumber: string) {
  try {
    await this.quizPublishService.completeQuiz(quizId, quizNumber);
    console.log('Quiz marked as completed!');
  } catch (error) {
    console.error('Failed to complete quiz:', error);
  }
}
```

---

## Real-time Event Subscriptions

### 🔔 Listen for Quiz Published Events

```typescript
ngOnInit() {
  this.quizPublishService.onQuizPublished.subscribe(data => {
    console.log('Quiz published:', data);
    // Update UI, show notification, etc.
  });
}
```

### 📊 Listen for Quiz Status Changes

```typescript
ngOnInit() {
  this.quizPublishService.onQuizStatusChanged.subscribe(data => {
    console.log(`Quiz ${data.quizNumber} status: ${data.status}`);
    // Update quiz list, refresh data, etc.
  });
}
```

### 👥 Listen for Participant Joins

```typescript
ngOnInit() {
  this.quizPublishService.onParticipantJoined.subscribe(data => {
    console.log(`${data.participantName} joined quiz ${data.quizNumber}`);
    // Show notification, update participant count
  });
}
```

### 🎬 Listen for Session Events

```typescript
ngOnInit() {
  // Session started
  this.quizPublishService.onQuizSessionStarted.subscribe(data => {
    console.log(`Session started for ${data.quizNumber}`);
    console.log(`Active participants: ${data.activeParticipants}`);
  });

  // Session ended
  this.quizPublishService.onQuizSessionEnded.subscribe(data => {
    console.log(`Session ended for ${data.quizNumber}`);
  });
}
```

### 🔌 Monitor Connection State

```typescript
ngOnInit() {
  this.quizPublishService.connectionState.subscribe(state => {
    console.log('Connection state:', state);
    // Update UI based on connection status
    if (state === 'connected') {
      this.showConnectedIndicator();
    } else if (state === 'disconnected') {
      this.showDisconnectedIndicator();
    }
  });
}
```

---

## Advanced Features

### 📢 Broadcasting to Participants

```typescript
async sendUpdateToParticipants(quizNumber: string) {
  const message = 'Quiz will start in 5 minutes!';
  const data = { countdown: 300 }; // 5 minutes in seconds
  
  await this.quizPublishService.broadcastToParticipants(
    quizNumber, 
    message, 
    data
  );
}
```

### 📊 Get Active Participants Count

```typescript
async checkParticipants(quizNumber: string) {
  try {
    const count = await this.quizPublishService.getActiveParticipants(quizNumber);
    console.log(`Active participants: ${count}`);
  } catch (error) {
    console.error('Failed to get participant count:', error);
  }
}
```

### ✅ Check Connection Status

```typescript
checkConnection() {
  const isConnected = this.quizPublishService.isConnected();
  const state = this.quizPublishService.getConnectionState();
  
  if (isConnected) {
    console.log('Connected to Quiz Hub');
  } else {
    console.log('Not connected. State:', state);
  }
}
```

---

## Complete Component Example

```typescript
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { QuizPublishService, QuizPublishData } from './services/quiz-publish.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-quiz-manager',
  template: `
    <div class="quiz-manager">
      <div class="connection-status" [class.connected]="isConnected">
        {{ connectionStatus }}
      </div>
      
      <button (click)="publishQuiz()" [disabled]="!isConnected">
        Publish Quiz
      </button>
      
      <button (click)="startSession()" [disabled]="!isConnected">
        Start Session
      </button>
      
      <div class="participants">
        Active Participants: {{ participantCount }}
      </div>
    </div>
  `
})
export class QuizManagerComponent implements OnInit, OnDestroy {
  private quizPublishService = inject(QuizPublishService);
  private subscriptions = new Subscription();
  
  isConnected = false;
  connectionStatus = 'Disconnected';
  participantCount = 0;
  hostId = '2463579';
  currentQuizId = 123;
  currentQuizNumber = 'QZ001';

  async ngOnInit() {
    // Initialize connection
    await this.quizPublishService.initializeConnection(this.hostId);
    
    // Subscribe to connection state
    this.subscriptions.add(
      this.quizPublishService.connectionState.subscribe(state => {
        this.isConnected = state === 'connected';
        this.connectionStatus = state.charAt(0).toUpperCase() + state.slice(1);
      })
    );
    
    // Subscribe to participant joins
    this.subscriptions.add(
      this.quizPublishService.onParticipantJoined.subscribe(data => {
        console.log('Participant joined:', data);
        this.updateParticipantCount();
      })
    );
    
    // Subscribe to quiz status changes
    this.subscriptions.add(
      this.quizPublishService.onQuizStatusChanged.subscribe(data => {
        console.log('Quiz status changed:', data);
        // Refresh your quiz list here
      })
    );
    
    // Subscribe to session events
    this.subscriptions.add(
      this.quizPublishService.onQuizSessionStarted.subscribe(data => {
        console.log('Session started:', data);
        this.participantCount = data.activeParticipants;
      })
    );
  }

  async publishQuiz() {
    try {
      await this.quizPublishService.publishQuiz(
        this.currentQuizId, 
        this.currentQuizNumber
      );
      alert('Quiz published successfully!');
    } catch (error) {
      alert('Failed to publish quiz');
    }
  }

  async startSession() {
    try {
      await this.quizPublishService.startQuizSession(this.currentQuizNumber);
      alert('Quiz session started!');
    } catch (error) {
      alert('Failed to start session');
    }
  }

  async updateParticipantCount() {
    try {
      this.participantCount = await this.quizPublishService.getActiveParticipants(
        this.currentQuizNumber
      );
    } catch (error) {
      console.error('Failed to get participant count');
    }
  }

  ngOnDestroy() {
    // Cleanup
    this.subscriptions.unsubscribe();
    this.quizPublishService.disconnect();
  }
}
```

---

## Backend Hub Requirements

Your C# SignalR Hub should implement these methods:

```csharp
public class QuizHub : Hub
{
    // Client calls this to join host group
    public async Task JoinHostGroup(string hostId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Host_{hostId}");
    }

    // Client calls this to publish quiz
    public async Task PublishQuiz(object quizData)
    {
        // Your logic to publish quiz
        await Clients.Group($"Host_{hostId}").SendAsync("QuizPublished", quizData);
    }

    // Client calls this to start session
    public async Task StartQuizSession(string quizNumber)
    {
        // Your logic
        await Clients.All.SendAsync("QuizSessionStarted", data);
    }

    // Client calls this to get participant count
    public Task<int> GetActiveParticipantsCount(string quizNumber)
    {
        // Return count
        return Task.FromResult(count);
    }

    // And similar methods for other operations...
}
```

---

## Error Handling

```typescript
try {
  await this.quizPublishService.publishQuiz(quizId, quizNumber);
} catch (error) {
  if (error.message.includes('Not connected')) {
    // Handle connection error
    await this.quizPublishService.initializeConnection(hostId);
  } else {
    // Handle other errors
    console.error('Publish failed:', error);
  }
}
```

---

## Best Practices

1. **Initialize Once**: Initialize the connection once in your main component (e.g., app component or dashboard)
2. **Cleanup**: Always call `disconnect()` in `ngOnDestroy()`
3. **Error Handling**: Wrap all async calls in try-catch blocks
4. **Connection Monitoring**: Subscribe to `connectionState` to track connection status
5. **Unsubscribe**: Use Subscription to manage and cleanup observables
6. **Reconnection**: The service handles auto-reconnection, but you may want to retry operations after reconnection

---

## TypeScript Interfaces

```typescript
// Quiz publish data
interface QuizPublishData {
  quizId: number;
  quizNumber: string;
  quizName: string;
  hostId: string;
  status: 'LIVE' | 'COMPLETED' | 'DRAFT';
  scheduledTime?: string;
  publishedAt: string;
}

// Status update
interface QuizStatusUpdate {
  quizId: number;
  quizNumber: string;
  status: 'LIVE' | 'COMPLETED' | 'DRAFT';
  timestamp: string;
}

// Participant data
interface ParticipantJoinedData {
  quizNumber: string;
  participantId: string;
  participantName: string;
  joinedAt: string;
}

// Session data
interface QuizSessionData {
  quizNumber: string;
  activeParticipants: number;
  startedAt: string;
}
```

---

## Troubleshooting

### Connection Issues
- Ensure `@microsoft/signalr` is installed: `npm install @microsoft/signalr`
- Check `environment.signalRUrl` is correctly configured
- Verify backend hub is running and accessible

### Not Receiving Events
- Ensure you've initialized the connection
- Check that event names match between client and server
- Verify you're in the correct SignalR group

### Publish Fails
- Check connection state before publishing
- Ensure quiz ID and number are correct
- Verify backend hub method exists and is public

---

## License
Part of CTS Quiz Application
