# Leaderboard Feature - Quick Reference Guide

## 🎯 What Was Implemented

Three main leaderboard features as requested:

1. **Show Leaderboard After Each Question** - Automatically displays leaderboard to participants when question timer ends
2. **View Leaderboard (Host)** - Host can view leaderboard anytime without affecting participants
3. **Show Leaderboard at End Only** - Displays leaderboard only when quiz completely ends

## 📁 Files Changed/Created

### ✅ Modified Files
- `src/app/services/signalr.service.ts`
- `src/app/feature/host-lobby/host-lobby.component.ts`
- `src/app/feature/host-lobby/host-lobby.component.html`
- `src/app/feature/host-lobby/host-lobby.component.css`
- `src/app/feature/quiz/quiz.component.ts`

### ✅ New Files Created
- `src/app/services/leaderboard.service.ts` - Service for leaderboard API calls
- `BACKEND_LEADERBOARD_IMPLEMENTATION.md` - Backend implementation guide
- `LEADERBOARD_IMPLEMENTATION_SUMMARY.md` - Complete feature documentation
- `LEADERBOARD_FLOW_DIAGRAM.md` - Visual flow diagrams

## 🎮 How to Use (Host)

### In Host Lobby After Starting Quiz:

1. **Enable After-Question Display:**
   - Click "📊 Show After Each Question" button
   - Button turns green with "✅ Showing After Questions"
   - Leaderboard will auto-show after every question

2. **Enable End-Only Display:**
   - Click "🏁 Show at End Only" button
   - Button turns green with "✅ Will Show at End"
   - Leaderboard will only show when quiz ends

3. **View Leaderboard (Host Only):**
   - Click "📊 View Leaderboard" button anytime
   - Opens leaderboard in new view
   - Participants NOT affected

4. **Manual Instant Toggle:**
   - Click "👁️ Show Leaderboard Now" / "🔒 Hide Leaderboard Now"
   - Instantly shows/hides for all participants
   - Works independently of other modes

## 🔧 Backend Setup Required

### 1. Database Migration
Run this SQL script:
```sql
ALTER TABLE QuizSessions
ADD ShowLeaderboardAfterQuestion BIT DEFAULT 0,
    ShowLeaderboardAtEndOnly BIT DEFAULT 0,
    LeaderboardVisible BIT DEFAULT 0;
```

### 2. Implement SignalR Hub Methods
Add these methods to `QuizSessionHub.cs`:
- `SetShowLeaderboardAfterQuestion(string sessionCode, bool enabled)`
- `SetShowLeaderboardAtEndOnly(string sessionCode, bool enabled)`
- `ToggleLeaderboard(string sessionCode, bool isVisible)`
- `ShowLeaderboardAfterQuestion(string sessionCode, int questionId)`
- `ShowLeaderboardAtEnd(string sessionCode)`

See `BACKEND_LEADERBOARD_IMPLEMENTATION.md` for complete code.

### 3. Create REST API Controller
Create `LeaderboardController.cs` with endpoints:
- `GET /api/Leaderboard/session/{sessionId}`
- `GET /api/Leaderboard/session/code/{sessionCode}`
- `GET /api/Leaderboard/settings/{sessionId}`
- `PUT /api/Leaderboard/settings`

## 🧪 Testing

### Frontend (Already Done)
✅ All frontend code implemented and ready
✅ SignalR events configured
✅ UI controls working
✅ Navigation logic in place

### Backend (To Do)
1. Test database column additions
2. Test SignalR hub methods
3. Verify leaderboard calculations
4. Test API endpoints
5. Test real-time broadcasting

### Integration Testing
1. Start quiz session
2. Enable "Show After Each Question"
3. Wait for question timer to expire
4. Verify all participants see leaderboard
5. Return to quiz and continue
6. Enable "Show at End Only"
7. End quiz
8. Verify final leaderboard displays

## 🚨 Important Notes

### Mutual Exclusivity
- "Show After Each Question" and "Show at End Only" are mutually exclusive
- Enabling one automatically disables the other
- Manual toggle works independently

### SignalR Events Flow
```
Host Action → Frontend → SignalR Hub → Backend → Database Update → Broadcast → All Participants
```

### Navigation
- Participants navigate to `/leaderboard` with query parameters
- Query params preserve session context
- `returnToQuiz=true` enables return functionality

## 🐛 Troubleshooting

### Leaderboard Not Showing
**Check:**
1. Backend SignalR hub implemented?
2. Database columns added?
3. Frontend SignalR connected? (check console)
4. Settings enabled in host lobby?

### Participants Not Receiving Events
**Check:**
1. All participants connected to same session?
2. SignalR group membership correct?
3. Event names match exactly (case-sensitive)?
4. Network/firewall blocking WebSockets?

### Host Can't Toggle Settings
**Check:**
1. Host connected to SignalR?
2. Connection status shows "CONNECTED"?
3. Session code valid?
4. Backend hub methods responding?

## 📊 Feature Matrix

| Feature | Host Control | Participant View | Timing | SignalR Event |
|---------|--------------|------------------|---------|---------------|
| Show After Question | Toggle button | Auto-navigate | After each Q timer | ShowLeaderboardAfterQuestion |
| Show at End Only | Toggle button | Auto-navigate | Quiz end only | ShowLeaderboardAtEnd |
| Manual Toggle | Instant button | See/hide live | Instant | LeaderboardVisibilityToggled |
| View Leaderboard | View button | No effect | Anytime | None (host only) |

## 🎨 UI Indicators

| Element | Normal State | Active State | Disabled State |
|---------|-------------|--------------|----------------|
| After-Question Button | Blue border | Green glow | Gray, 50% opacity |
| End-Only Button | Blue border | Green glow | Gray, 50% opacity |
| Manual Toggle | Blue/Cognizant color | Changes icon/text | N/A |
| View Button | Primary gradient | Hover effect | N/A |

## 📝 Code Snippets

### Enable After-Question Mode (TypeScript)
```typescript
async toggleShowAfterQuestion() {
  const newSetting = !this.showLeaderboardAfterQuestion();
  await this.hubConnection.invoke('SetShowLeaderboardAfterQuestion', 
    this.sessionCode(), newSetting);
  this.showLeaderboardAfterQuestion.set(newSetting);
}
```

### Show Leaderboard After Question (C# Backend)
```csharp
public async Task ShowLeaderboardAfterQuestion(string sessionCode, int questionId)
{
    await UpdateLeaderboardForSession(sessionId);
    var leaderboard = await GetLeaderboardData(sessionId);
    
    await Clients.Group(sessionCode).SendAsync("ShowLeaderboardAfterQuestion", new
    {
        SessionCode = sessionCode,
        QuestionId = questionId,
        Leaderboard = leaderboard
    });
}
```

### Listen for Event (Participant TypeScript)
```typescript
this.hubConnection.on('ShowLeaderboardAfterQuestion', (data: any) => {
  this.router.navigate(['/leaderboard'], {
    queryParams: {
      sessionId: this.sessionId,
      questionId: data.questionId,
      returnToQuiz: 'true'
    }
  });
});
```

## 🔗 Related Documentation

- **Backend Guide:** `BACKEND_LEADERBOARD_IMPLEMENTATION.md`
- **Feature Summary:** `LEADERBOARD_IMPLEMENTATION_SUMMARY.md`
- **Flow Diagrams:** `LEADERBOARD_FLOW_DIAGRAM.md`

## 📞 Support

If you encounter issues:
1. Check console logs (browser DevTools)
2. Verify SignalR connection status
3. Review backend logs
4. Ensure database schema updated
5. Test with minimal session (1-2 participants)

## ✅ Deployment Checklist

- [ ] Frontend code deployed
- [ ] Backend SignalR hub methods implemented
- [ ] Database migrations run
- [ ] API endpoints created
- [ ] SignalR hub URL configured
- [ ] Environment variables set
- [ ] CORS configured for SignalR
- [ ] WebSocket support enabled
- [ ] Test with real quiz session
- [ ] Monitor logs for errors

---

**Ready to Use!** The frontend is complete. Implement the backend per the guide and test the full flow.
