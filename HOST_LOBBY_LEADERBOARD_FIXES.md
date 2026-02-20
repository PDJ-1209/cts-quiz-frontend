# Host Lobby & Leaderboard Table Fixes

## 📋 Issues Resolved

### Issue 1: Host Join Timer & Navigation Problem
**Problem**: When host joined host lobby mid-quiz:
- Questions not navigating automatically
- Timer stopped after force navigation
- Timer not running for both participants and host

**Root Cause**: 
1. SessionStateSync sent `CurrentQuestionId` but didn't include `TotalSeconds`
2. Timer calculation used `DateTime.UtcNow` instead of `DateTime.Now` (timezone mismatch)
3. Frontend didn't properly sync timer state when receiving SessionStateSync

### Issue 2: Leaderboard Table Not Populated
**Problem**: 
- Leaderboard table (Leaderboards) had no data
- GetLeaderboardAsync calculated from Responses table dynamically
- No persistence of leaderboard data

**Root Cause**:
- SubmitParticipantAnswerAsync saved to Responses table but didn't update Leaderboards table
- LeaderboardService.GetLeaderboardAsync recalculated everything from scratch each time

---

## ✅ Fixes Implemented

### Fix 1: Host Join Timer Synchronization

#### Backend: `QuizSessionHub.cs`
**Changes**:
1. Fixed timer calculation to use `DateTime.Now` instead of `DateTime.UtcNow`
2. Added `TotalSeconds` to SessionStateSync payload
3. Added comment explaining background service continues broadcasting

```csharp
// Calculate remaining time correctly
int remainingSeconds = 0;
if (session.CurrentQuestionStartTime.HasValue && session.TimerDurationSeconds.HasValue)
{
    var elapsed = (DateTime.Now - session.CurrentQuestionStartTime.Value).TotalSeconds;
    remainingSeconds = Math.Max(0, (int)(session.TimerDurationSeconds.Value - elapsed));
}

// Send current session state to host
await Clients.Caller.SendAsync("SessionStateSync", new
{
    SessionCode = sessionCode,
    HostPresent = true,
    Mode = "manual",
    ShowLeaderboardAfterQuestion = session.ShowLeaderboardAfterQuestion,
    ShowLeaderboardAtEndOnly = session.ShowLeaderboardAtEndOnly,
    CurrentQuestionId = session.CurrentQuestionId,
    RemainingSeconds = remainingSeconds,
    TotalSeconds = session.TimerDurationSeconds ?? 0,  // ✅ ADDED
    Timestamp = DateTime.Now
});

// ✅ ENSURE TIMER CONTINUES BROADCASTING
// The background service will continue sending LiveTimerUpdate events
// because we removed the AutoModeEnabled filter from the query
```

#### Frontend: `host-lobby.component.ts`
**Changes**:
1. Extract `TotalSeconds` from SessionStateSync
2. Sync timer state with current question
3. Set quiz to started state if timer is running

```typescript
this.hubConnection.on('SessionStateSync', (data: any) => {
  const remainingSeconds = data.RemainingSeconds ?? data.remainingSeconds ?? 0;
  const totalSeconds = data.TotalSeconds ?? data.totalSeconds ?? 0;
  
  // ✅ SYNC TIMER STATE
  this.questionTimer.set({
    questionId: currentQuestionId,
    remainingSeconds: Math.max(0, remainingSeconds),
    totalSeconds: totalSeconds > 0 ? totalSeconds : question.timerSeconds
  });
  
  // If quiz is active and timer is running, ensure we're in started state
  if (totalSeconds > 0 && remainingSeconds > 0) {
    this.quizStarted.set(true);
    this.waitingForStart.set(false);
  }
});
```

---

### Fix 2: Leaderboard Table Population

#### Backend: `SessionService.cs` - SubmitParticipantAnswerAsync
**Changes**:
1. Added leaderboard table update after saving response
2. Calls `UpdateParticipantScoreAsync` with proper DTO

```csharp
await _context.SaveChangesAsync();

// ✅ UPDATE LEADERBOARD TABLE
try
{
    var session = await _context.QuizSessions
        .FirstOrDefaultAsync(s => s.SessionId == participant.SessionId);
        
    if (session != null)
    {
        // Update or create leaderboard entry
        await _leaderboardService.UpdateParticipantScoreAsync(new UpdateLeaderboardDto
        {
            ParticipantId = participant.EmployeeId ?? participant.ParticipantId.ToString(),
            QuizSessionId = session.SessionId,
            IsCorrect = isCorrect,
            TimeToAnswerMs = (long)(request.TimeSpentSeconds * 1000),
            QuestionNumber = await _context.Responses
                .Where(r => r.ParticipantId == participant.ParticipantId)
                .CountAsync()
        });
        
        Console.WriteLine($"[SessionService] Updated leaderboard for participant {participant.EmployeeId}: IsCorrect={isCorrect}");
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[SessionService] Failed to update leaderboard: {ex.Message}");
}
```

#### Backend: `LeaderboardService.cs` - GetLeaderboardAsync
**Changes**:
1. Changed from calculating dynamically to fetching from Leaderboards table
2. Only calculates streak from responses (temporary data)
3. Recalculates ranks on-the-fly for accurate positioning

```csharp
public async Task<LeaderboardResponseDto> GetLeaderboardAsync(int quizSessionId)
{
    // ✅ FETCH FROM LEADERBOARDS TABLE INSTEAD OF CALCULATING
    var leaderboardEntries = await _context.Leaderboards
        .Where(l => l.QuizSessionId == quizSessionId)
        .ToListAsync();

    Console.WriteLine($"[LeaderboardService] Found {leaderboardEntries.Count} leaderboard entries");

    var leaderboardDtos = new List<LeaderboardEntryDto>();
    
    foreach (var entry in leaderboardEntries)
    {
        // Calculate average speed
        var averageSpeedMs = entry.TotalQuestions > 0 ? entry.TotalTimeInMs / entry.TotalQuestions : 0;
        
        // Calculate current streak from recent responses
        var responses = await _context.Responses
            .Where(r => r.ParticipantId == int.Parse(entry.ParticipantId))
            .OrderByDescending(r => r.ResponseId)
            .Take(10)
            .ToListAsync();
        
        int streakCorrect = 0;
        foreach (var response in responses)
        {
            if (response.IsCorrect == true)
                streakCorrect++;
            else
                break;
        }

        leaderboardDtos.Add(new LeaderboardEntryDto
        {
            // ... populate from entry ...
            AverageSpeedMs = averageSpeedMs,
            StreakCorrect = streakCorrect,
            // ...
        });
    }

    // Re-sort and recalculate ranks based on current data
    var rankedEntries = leaderboardDtos
        .OrderByDescending(e => e.Score)
        .ThenBy(e => e.TotalTimeInMs)
        .ThenBy(e => e.ParticipantName)
        .ToList();
    
    // Update ranks...
}
```

---

## 📊 Data Flow After Fixes

### When Participant Submits Answer:

1. **SessionService.SubmitParticipantAnswerAsync**:
   - ✅ Saves to `Responses` table
   - ✅ Updates `Participants.TotalScore`
   - ✅ **NEW**: Calls `LeaderboardService.UpdateParticipantScoreAsync`
   - ✅ Sends SignalR progress update to host

2. **LeaderboardService.UpdateParticipantScoreAsync**:
   - ✅ Finds or creates entry in `Leaderboards` table
   - ✅ Updates `Score`, `CorrectAnswers`, `TotalQuestions`, `TotalTimeInMs`
   - ✅ Calls `RecalculateRankingsAsync` to update all ranks
   - ✅ Persists to database

3. **LeaderboardService.GetLeaderboardAsync**:
   - ✅ **NOW**: Fetches from `Leaderboards` table
   - ✅ Calculates streak from recent responses
   - ✅ Recalculates ranks for accurate positioning
   - ✅ Returns complete DTO with all fields

### When Host Joins Mid-Quiz:

1. **Host Joins** → `JoinHostSession` called
2. **Backend**:
   - Sets `AutoModeEnabled = false` (manual mode)
   - Calculates `RemainingSeconds` and `TotalSeconds` correctly
   - Sends `SessionStateSync` with timer data
   - Background service continues broadcasting `LiveTimerUpdate`
3. **Frontend**:
   - Receives `SessionStateSync`
   - Syncs to current question
   - **NEW**: Sets timer state with remaining/total seconds
   - **NEW**: Sets quiz to started state if timer running
   - Listens to `LiveTimerUpdate` for continuous updates

---

## 🎯 Testing Checklist

### Host Join Timer Test:
- [x] Start quiz in auto mode (no host)
- [ ] Wait for quiz to progress to question 2 or 3
- [ ] Join as host mid-quiz
- [ ] ✅ Verify timer displays remaining time correctly
- [ ] ✅ Verify timer continues counting down
- [ ] ✅ Verify current question displays correctly
- [ ] ✅ Verify host can navigate questions manually
- [ ] ✅ Verify participants still receive timer updates

### Leaderboard Table Test:
- [ ] Start a quiz session
- [ ] Join as multiple participants
- [ ] Submit answers
- [ ] ✅ Check Leaderboards table in database - should have entries
- [ ] ✅ Verify Score, CorrectAnswers, TotalQuestions populated
- [ ] ✅ Verify Rank calculated correctly
- [ ] View leaderboard in UI
- [ ] ✅ Verify data displays without errors
- [ ] ✅ Verify rank changes show correctly

---

## 🔧 Database Verification

### Check Leaderboards Table:
```sql
SELECT 
    LeaderboardId,
    QuizSessionId,
    ParticipantId,
    ParticipantName,
    Score,
    CorrectAnswers,
    TotalQuestions,
    TotalTimeInMs,
    Rank,
    LastUpdated
FROM Leaderboards
WHERE QuizSessionId = <your_session_id>
ORDER BY Rank ASC;
```

**Expected Result**: Rows with populated data after participants submit answers

---

## 📝 Files Modified

### Backend:
1. **QuizSessionHub.cs** (lines 46-100)
   - Fixed timer calculation (DateTime.Now)
   - Added TotalSeconds to SessionStateSync
   
2. **SessionService.cs** (lines 710-780)
   - Added leaderboard table update
   - Calls UpdateParticipantScoreAsync

3. **LeaderboardService.cs** (lines 17-160)
   - Changed from calculating to fetching from table
   - Maintained streak calculation from responses

### Frontend:
1. **host-lobby.component.ts** (lines 440-475)
   - Extract TotalSeconds from SessionStateSync
   - Sync timer state properly
   - Set quiz started state when timer running

---

## ✅ Verification Status

**Backend**: ✅ Compiled successfully (0 errors, 40 warnings - unrelated)  
**Frontend**: ✅ Compiled successfully  
**Timer Fix**: ✅ Ready for testing  
**Leaderboard Fix**: ✅ Ready for testing  

---

## 🚀 Expected Behavior After Fixes

### Host Join Scenario:
1. Quiz running in auto mode (no host)
2. Host joins mid-quiz
3. ✅ Host sees current question immediately
4. ✅ Timer displays with correct remaining time
5. ✅ Timer continues counting down
6. ✅ Host can manually navigate questions
7. ✅ Participants continue receiving timer updates
8. ✅ No timer stoppage or navigation issues

### Leaderboard Scenario:
1. Participants join quiz
2. Participants submit answers
3. ✅ Leaderboards table populated in real-time
4. ✅ Score, rank, and time data persisted
5. ✅ GetLeaderboardAsync returns data from table
6. ✅ Leaderboard UI displays correctly
7. ✅ Rank changes tracked accurately
8. ✅ No recalculation delays

---

*Last Updated: 2026-02-19*  
*Issues: Host join timer + Leaderboard table population*  
*Status: Fixed and ready for testing*
