# Quick Start Guide: Using ParticipantResponsesComponent

## 🚀 Quick Navigation Examples

### 1. From Participant Dashboard
Add this button to your participant dashboard component:

```typescript
// participant-dashboard.component.ts
import { Router } from '@angular/router';

export class ParticipantDashboardComponent {
  currentParticipantId = 123; // Get from auth service
  
  constructor(private router: Router) {}
  
  viewMyPollResponses(pollId: number, sessionCode?: string): void {
    this.router.navigate(['/participant/responses'], {
      queryParams: {
        participantId: this.currentParticipantId,
        pollId: pollId,
        sessionCode: sessionCode
      }
    });
  }
  
  viewMySurveyResponses(surveyId: number, sessionCode?: string): void {
    this.router.navigate(['/participant/responses'], {
      queryParams: {
        participantId: this.currentParticipantId,
        surveyId: surveyId,
        sessionCode: sessionCode
      }
    });
  }
  
  viewAllResponses(pollId: number, surveyId: number, sessionCode: string): void {
    this.router.navigate(['/participant/responses'], {
      queryParams: {
        participantId: this.currentParticipantId,
        pollId: pollId,
        surveyId: surveyId,
        sessionCode: sessionCode
      }
    });
  }
}
```

```html
<!-- participant-dashboard.component.html -->
<button (click)="viewMyPollResponses(poll.pollId, poll.sessionCode)">
  View My Poll Responses
</button>

<button (click)="viewMySurveyResponses(survey.surveyId, survey.sessionCode)">
  View My Survey Responses
</button>
```

---

### 2. After Submitting a Survey
Navigate automatically after submission:

```typescript
// survey-participate.component.ts
submitSurvey(): void {
  this.surveyService.submitSurveyResponses(this.responses).subscribe({
    next: () => {
      // Navigate to view submitted responses
      this.router.navigate(['/participant/responses'], {
        queryParams: {
          participantId: this.participantId,
          surveyId: this.surveyId,
          sessionCode: this.sessionCode
        }
      });
    },
    error: (error) => {
      console.error('Submission failed', error);
    }
  });
}
```

---

### 3. HTML RouterLink Examples

```html
<!-- Simple poll responses link -->
<a [routerLink]="['/participant/responses']" 
   [queryParams]="{participantId: participant.id, pollId: poll.id}">
  View Poll Responses
</a>

<!-- Survey responses with live updates -->
<a [routerLink]="['/participant/responses']" 
   [queryParams]="{
     participantId: participant.id, 
     surveyId: survey.id, 
     sessionCode: session.code
   }">
  View Live Survey Responses
</a>

<!-- Both poll and survey -->
<a [routerLink]="['/participant/responses']" 
   [queryParams]="{
     participantId: participant.id, 
     pollId: poll.id, 
     surveyId: survey.id, 
     sessionCode: session.code
   }">
  View All My Responses
</a>
```

---

## 📊 Query Parameters Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `participantId` | number | ✅ Yes | The participant's unique ID |
| `pollId` | number | ❌ No | Poll ID to view poll responses |
| `surveyId` | number | ❌ No | Survey ID to view survey responses |
| `sessionCode` | string | ❌ No | Session code for SignalR live updates |

**Note**: At least one of `pollId` or `surveyId` must be provided.

---

## 🔗 Example URLs

```
# View only poll responses
/participant/responses?participantId=123&pollId=456

# View only survey responses
/participant/responses?participantId=123&surveyId=789

# View both without live updates
/participant/responses?participantId=123&pollId=456&surveyId=789

# View with live SignalR updates
/participant/responses?participantId=123&pollId=456&sessionCode=ABC123

# Full example with all parameters
/participant/responses?participantId=123&pollId=456&surveyId=789&sessionCode=ABC123
```

---

## 🎨 UI Features Available

### Tabs (when both poll and survey provided)
- Automatically shows tabs if both `pollId` and `surveyId` are in query params
- Badge counts show number of responses
- Active tab indicator
- Smooth transitions

### Connection Status
- Only shows if `sessionCode` is provided
- Real-time status indicator:
  - 🟢 **Connected** - SignalR active
  - 🔴 **Disconnected** - No connection
  - 🟠 **Reconnecting...** - Attempting reconnection

### Countdown Timer
- Appears when poll/survey starts
- Real-time countdown from server
- Visual warnings at 10s and 5s
- Auto-hides when complete

### Response Display
Different styling for each type:
- **Single-choice**: Single answer with label
- **Multi-select**: Multiple answers with checkmarks
- **Ranking**: Ordered list with rank badges (1️⃣ 2️⃣ 3️⃣)
- **Text**: Full text response
- **Scale**: "Rating: X" format

---

## 🔄 SignalR Integration

### When to Include SessionCode

**Include sessionCode** when:
- Participant is in an active session
- You want real-time updates
- Countdown timer should be visible
- Auto-navigation on question change is needed
- Reconnection is required

**Don't include sessionCode** when:
- Just viewing historical responses
- Session has ended
- No live updates needed
- Viewing past submissions

### Example with Auth Service

```typescript
export class ParticipantService {
  constructor(
    private router: Router,
    private authService: AuthService,
    private sessionService: SessionService
  ) {}
  
  viewResponses(pollId?: number, surveyId?: number): void {
    const participantId = this.authService.getCurrentUserId();
    const activeSession = this.sessionService.getActiveSession();
    
    this.router.navigate(['/participant/responses'], {
      queryParams: {
        participantId: participantId,
        pollId: pollId,
        surveyId: surveyId,
        sessionCode: activeSession?.sessionCode // Optional
      }
    });
  }
}
```

---

## ⚠️ Error Handling

The component handles these error cases:

1. **No Participant ID** → Shows error: "Participant ID is required"
2. **No Poll/Survey ID** → Shows error: "Please provide either a Poll ID or Survey ID"
3. **API Failure** → Shows error: "Failed to load responses"
4. **Session Ended** → Alert + redirect to dashboard
5. **Reconnection Failed** → Alert + redirect to dashboard

---

## 🎯 Integration Checklist

Before navigating to the component, ensure:

- [ ] Participant ID is available (from auth service)
- [ ] Poll ID or Survey ID is available
- [ ] Session code is available (if live updates needed)
- [ ] User has "User" role (roleId: 3)
- [ ] Backend endpoints are accessible:
  - `GET /Participate/Poll/responses/participant/{participantId}/poll/{pollId}`
  - `GET /Participate/Survey/responses/participant/{participantId}/survey/{surveyId}`
- [ ] SignalR hub is running (if using sessionCode)

---

## 💡 Best Practices

### 1. Store Participant Context
```typescript
// Store in service or state management
export class ParticipantContextService {
  private participantId: number;
  private activeSessionCode: string;
  
  setContext(participantId: number, sessionCode: string): void {
    this.participantId = participantId;
    this.activeSessionCode = sessionCode;
  }
  
  navigateToResponses(pollId?: number, surveyId?: number): void {
    this.router.navigate(['/participant/responses'], {
      queryParams: {
        participantId: this.participantId,
        pollId: pollId,
        surveyId: surveyId,
        sessionCode: this.activeSessionCode
      }
    });
  }
}
```

### 2. Add Menu Item
```html
<!-- In participant navigation menu -->
<nav>
  <a [routerLink]="['/participant/responses']" 
     [queryParams]="{participantId: currentParticipantId}">
    <i class="icon-responses"></i>
    My Responses
  </a>
</nav>
```

### 3. Show Response Count
```typescript
// In participant dashboard
getPollResponseCount(participantId: number, pollId: number): Observable<number> {
  return this.pollService.getPollResponsesByParticipant(participantId, pollId)
    .pipe(map(responses => responses.length));
}
```

```html
<div class="poll-card">
  <h3>{{ poll.title }}</h3>
  <p>Your responses: {{ responseCount$ | async }}</p>
  <button (click)="viewResponses(poll.pollId)">View Details</button>
</div>
```

---

## 🚀 Quick Test

To quickly test the component:

1. Navigate to: `/participant/responses?participantId=1&pollId=1`
2. Check if poll responses load
3. Navigate to: `/participant/responses?participantId=1&surveyId=1`
4. Check if survey responses load
5. Navigate with sessionCode to test live updates
6. Test tab switching
7. Test refresh button
8. Test back button

---

## 📚 Related Files

- **Component**: `src/app/feature/participant-responses/participant-responses.component.ts`
- **Template**: `src/app/feature/participant-responses/participant-responses.component.html`
- **Styles**: `src/app/feature/participant-responses/participant-responses.component.css`
- **Route**: `src/app/app.routes.ts` (line ~175)
- **Poll Service**: `src/app/services/poll.service.ts`
- **Survey Service**: `src/app/services/survey.service.ts`
- **SignalR Service**: `src/app/services/signalr.service.ts`
- **Models**: `src/app/models/ipoll.ts`, `src/app/models/isurvey.ts`

---

## ✅ Verification Steps

After integration, verify:

1. **Navigation works** from different components
2. **Query params** are correctly passed
3. **Data loads** for poll and survey responses
4. **Tabs appear** when both IDs provided
5. **SignalR connects** when sessionCode provided
6. **Countdown shows** when session starts
7. **Live updates work** during active session
8. **Reconnection works** after disconnect
9. **Error handling** shows appropriate messages
10. **Back button** returns to dashboard

---

## 🎉 You're All Set!

The component is fully integrated and ready to use. Just navigate with the appropriate query parameters and it will handle the rest!

For detailed implementation docs, see: `PARTICIPANT_RESPONSES_IMPLEMENTATION.md`
