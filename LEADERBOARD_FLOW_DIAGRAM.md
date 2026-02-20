# Leaderboard Feature Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST LOBBY                               │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Display Control Buttons:                              │    │
│  │  [📊 Show After Each Question] [🏁 Show at End Only]  │    │
│  │  [👁️ Show Now] [📊 View Leaderboard]                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│              SignalR Hub Connection                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (C# .NET)                           │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  QuizSessionHub SignalR Methods:                        │    │
│  │  • SetShowLeaderboardAfterQuestion()                    │    │
│  │  • SetShowLeaderboardAtEndOnly()                        │    │
│  │  • ToggleLeaderboard()                                  │    │
│  │  • ShowLeaderboardAfterQuestion()                       │    │
│  │  • ShowLeaderboardAtEnd()                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Database (SQL Server)                                  │    │
│  │  QuizSessions Table:                                    │    │
│  │  • ShowLeaderboardAfterQuestion (BIT)                   │    │
│  │  • ShowLeaderboardAtEndOnly (BIT)                       │    │
│  │  • LeaderboardVisible (BIT)                             │    │
│  │                                                          │    │
│  │  Leaderboard Table:                                     │    │
│  │  • ParticipantId, Score, Rank, etc.                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│              Broadcast to Participants                           │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PARTICIPANT QUIZ VIEW                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Quiz Component (quiz.component.ts)                     │    │
│  │  Listens for SignalR Events:                            │    │
│  │  • ShowLeaderboardAfterQuestion → Navigate to LB        │    │
│  │  • ShowLeaderboardAtEnd → Navigate to Final LB          │    │
│  │  • LeaderboardVisibilityToggled → Show/Hide             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Feature 1: Show After Each Question

```
Timeline:
─────────────────────────────────────────────────────────────────

1. Host enables "Show After Each Question"
   │
   ├─► Frontend: showLeaderboardAfterQuestion.set(true)
   │
   ├─► SignalR: SetShowLeaderboardAfterQuestion(sessionCode, true)
   │
   └─► Backend: Updates QuizSessions.ShowLeaderboardAfterQuestion = true

2. Question timer expires (automatic)
   │
   ├─► Host Lobby: Detects timer at 0 seconds
   │
   ├─► SignalR: ShowLeaderboardAfterQuestion(sessionCode, questionId)
   │
   ├─► Backend: Calculates leaderboard rankings
   │
   └─► Backend: Broadcasts "ShowLeaderboardAfterQuestion" event

3. All participants receive event
   │
   ├─► Quiz Component: Listens for event
   │
   ├─► Navigate to: /leaderboard?sessionId=X&questionId=Y
   │
   └─► Display current rankings

4. After viewing (5-10 seconds or manual return)
   │
   ├─► Participants return to quiz
   │
   └─► Continue with next question
```

## Feature 2: Host Views Leaderboard

```
Timeline:
─────────────────────────────────────────────────────────────────

1. Host clicks "View Leaderboard" button
   │
   ├─► Frontend: viewLeaderboard() method called
   │
   └─► Navigate to: /leaderboard?sessionId=X&sessionCode=Y

2. Leaderboard Component loads
   │
   ├─► Connects to LeaderboardHub (SignalR)
   │
   ├─► HTTP GET: /api/Leaderboard/session/{sessionId}
   │
   └─► Displays real-time rankings

3. Real-time updates
   │
   ├─► Listens to "LeaderboardUpdated" events
   │
   ├─► Updates rankings as participants answer
   │
   └─► Host sees live competition

4. Participants continue quiz
   │
   └─► Unaffected by host viewing leaderboard
```

## Feature 3: Show at End Only

```
Timeline:
─────────────────────────────────────────────────────────────────

1. Host enables "Show at End Only"
   │
   ├─► Frontend: showLeaderboardAtEndOnly.set(true)
   │
   ├─► SignalR: SetShowLeaderboardAtEndOnly(sessionCode, true)
   │
   └─► Backend: Updates QuizSessions.ShowLeaderboardAtEndOnly = true

2. Quiz ends (manual or automatic)
   │
   ├─► Host Lobby: manualEndQuiz() OR last question timer expires
   │
   ├─► Check: if (showLeaderboardAtEndOnly())
   │
   ├─► SignalR: ShowLeaderboardAtEnd(sessionCode)
   │
   └─► Backend: Calculates final leaderboard

3. All participants receive event
   │
   ├─► Quiz Component: Listens for "ShowLeaderboardAtEnd"
   │
   ├─► Navigate to: /leaderboard?sessionId=X&final=true
   │
   └─► Display final rankings with complete stats

4. Quiz session complete
   │
   ├─► Participants see final results
   │
   └─► Can navigate to feedback/results page
```

## Data Flow for Leaderboard Calculation

```
┌──────────────────────────────────────────────────────┐
│  Participant Submits Answer                          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Backend: Save to ParticipantAnswers Table           │
│  • ParticipantId, QuestionId, SelectedOption         │
│  • IsCorrect, TimeToAnswer, SubmittedAt             │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Backend: UpdateLeaderboardForSession()              │
│  1. Query all answers for session                    │
│  2. GROUP BY ParticipantId                           │
│  3. Calculate: Score, CorrectAnswers, AvgTime        │
│  4. ORDER BY Score DESC, AvgTime ASC                 │
│  5. Assign Ranks (1, 2, 3, ...)                      │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Backend: Update/Insert Leaderboard Table            │
│  • ParticipantId, Score, Rank                        │
│  • CorrectAnswers, TotalQuestions                    │
│  • AverageTime, LastUpdated                          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  SignalR: Broadcast LeaderboardUpdated Event         │
│  To: All connected clients in session                │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Frontend: Leaderboard Component Updates UI          │
│  • Animate position changes (FLIP animation)         │
│  • Update scores and ranks                           │
│  • Highlight current user                            │
└──────────────────────────────────────────────────────┘
```

## Event Communication Matrix

| Event Name | Sender | Receiver | Trigger | Purpose |
|-----------|---------|----------|---------|---------|
| SetShowLeaderboardAfterQuestion | Host Lobby | Backend Hub | Host toggles button | Enable/disable after-question mode |
| SetShowLeaderboardAtEndOnly | Host Lobby | Backend Hub | Host toggles button | Enable/disable end-only mode |
| ToggleLeaderboard | Host Lobby | Backend Hub | Host toggles manual button | Show/hide leaderboard instantly |
| ShowLeaderboardAfterQuestion | Backend Hub | All Participants | Question timer expires | Display leaderboard after question |
| ShowLeaderboardAtEnd | Backend Hub | All Participants | Quiz ends | Display final leaderboard |
| LeaderboardVisibilityToggled | Backend Hub | All Participants | Manual toggle by host | Update participant visibility state |
| LeaderboardUpdated | Backend Hub | All Clients | Answer submitted | Real-time ranking updates |

## Component Responsibilities

### Host Lobby Component
- ✅ Provide UI controls for leaderboard settings
- ✅ Manage leaderboard mode signals (after-question, end-only)
- ✅ Send SignalR commands to backend
- ✅ Trigger leaderboard display at appropriate times
- ✅ Navigate host to leaderboard view

### Quiz Component (Participant)
- ✅ Listen for leaderboard SignalR events
- ✅ Navigate to leaderboard when instructed
- ✅ Preserve quiz state during leaderboard view
- ✅ Return to quiz after viewing
- ✅ Display notifications about leaderboard status

### Leaderboard Component
- ✅ Connect to LeaderboardHub
- ✅ Fetch leaderboard data from API
- ✅ Display rankings with animations
- ✅ Update in real-time as scores change
- ✅ Handle both participant and host views
- ✅ Support different display modes (after-question, final)

### SignalR Service
- ✅ Manage hub connections
- ✅ Provide event streams for components
- ✅ Handle reconnection logic
- ✅ Separate leaderboard hub from main quiz hub

### Leaderboard Service
- ✅ HTTP API calls for leaderboard data
- ✅ Settings management
- ✅ Visibility state management
- ✅ Type-safe interfaces for data models

## Settings Mutual Exclusivity

```
┌─────────────────────────────────────────────────┐
│  Leaderboard Display Modes (Mutually Exclusive) │
└─────────────────────────────────────────────────┘

Mode 1: Show After Each Question
├─ When Enabled:
│  ├─ ShowLeaderboardAfterQuestion = true
│  └─ ShowLeaderboardAtEndOnly = false (auto-disabled)
├─ Behavior:
│  └─ Leaderboard appears after EVERY question timer expires

Mode 2: Show at End Only
├─ When Enabled:
│  ├─ ShowLeaderboardAtEndOnly = true
│  └─ ShowLeaderboardAfterQuestion = false (auto-disabled)
├─ Behavior:
│  └─ Leaderboard appears ONLY when quiz completely ends

Mode 3: Manual Control (Independent)
├─ Can be used with either mode above
├─ LeaderboardVisible = true/false
└─ Instant toggle via SignalR broadcast
```
