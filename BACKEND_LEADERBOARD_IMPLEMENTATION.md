# Backend Implementation Guide for Leaderboard Features

## Overview
This guide details the backend changes needed to support the leaderboard visibility controls implemented in the frontend.

## Database Changes

### 1. Add Leaderboard Settings to QuizSession Table

Add the following columns to the `QuizSessions` table:

```sql
ALTER TABLE QuizSessions
ADD ShowLeaderboardAfterQuestion BIT DEFAULT 0,
    ShowLeaderboardAtEndOnly BIT DEFAULT 0,
    LeaderboardVisible BIT DEFAULT 0;
```

**Column Descriptions:**
- `ShowLeaderboardAfterQuestion`: When TRUE, automatically shows leaderboard to participants after each question timer expires
- `ShowLeaderboardAtEndOnly`: When TRUE, shows leaderboard only when the quiz ends
- `LeaderboardVisible`: Current real-time visibility state (can be toggled manually by host)

### 2. Create Leaderboard Table (if not exists)

```sql
CREATE TABLE Leaderboard (
    LeaderboardId INT PRIMARY KEY IDENTITY(1,1),
    SessionId INT NOT NULL,
    ParticipantId INT NOT NULL,
    Score INT DEFAULT 0,
    Rank INT DEFAULT 0,
    CorrectAnswers INT DEFAULT 0,
    TotalQuestions INT DEFAULT 0,
    AverageTime DECIMAL(10,2) NULL,
    LastUpdated DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (SessionId) REFERENCES QuizSessions(SessionId),
    FOREIGN KEY (ParticipantId) REFERENCES Participants(ParticipantId)
);
```

## SignalR Hub Methods

### QuizSessionHub.cs

Add the following methods to your existing `QuizSessionHub`:

```csharp
/// <summary>
/// Toggle leaderboard visibility for participants in real-time
/// </summary>
public async Task ToggleLeaderboard(string sessionCode, bool isVisible)
{
    var session = await _context.QuizSessions
        .FirstOrDefaultAsync(s => s.SessionCode == sessionCode);
    
    if (session == null)
        throw new HubException("Session not found");
    
    // Update database
    session.LeaderboardVisible = isVisible;
    await _context.SaveChangesAsync();
    
    // Notify all participants in the session
    await Clients.Group(sessionCode).SendAsync("LeaderboardVisibilityToggled", new
    {
        SessionCode = sessionCode,
        IsVisible = isVisible,
        Timestamp = DateTime.UtcNow
    });
    
    // Confirm to host
    await Clients.Caller.SendAsync("LeaderboardToggleConfirmed", new
    {
        IsVisible = isVisible
    });
}

/// <summary>
/// Set whether to show leaderboard after each question
/// </summary>
public async Task SetShowLeaderboardAfterQuestion(string sessionCode, bool enabled)
{
    var session = await _context.QuizSessions
        .FirstOrDefaultAsync(s => s.SessionCode == sessionCode);
    
    if (session == null)
        throw new HubException("Session not found");
    
    session.ShowLeaderboardAfterQuestion = enabled;
    
    // If enabling, disable end-only mode
    if (enabled)
        session.ShowLeaderboardAtEndOnly = false;
    
    await _context.SaveChangesAsync();
    
    await Clients.Caller.SendAsync("LeaderboardSettingUpdated", new
    {
        ShowAfterQuestion = enabled,
        ShowAtEndOnly = session.ShowLeaderboardAtEndOnly
    });
}

/// <summary>
/// Set whether to show leaderboard only at quiz end
/// </summary>
public async Task SetShowLeaderboardAtEndOnly(string sessionCode, bool enabled)
{
    var session = await _context.QuizSessions
        .FirstOrDefaultAsync(s => s.SessionCode == sessionCode);
    
    if (session == null)
        throw new HubException("Session not found");
    
    session.ShowLeaderboardAtEndOnly = enabled;
    
    // If enabling, disable after-question mode
    if (enabled)
        session.ShowLeaderboardAfterQuestion = false;
    
    await _context.SaveChangesAsync();
    
    await Clients.Caller.SendAsync("LeaderboardSettingUpdated", new
    {
        ShowAfterQuestion = session.ShowLeaderboardAfterQuestion,
        ShowAtEndOnly = enabled
    });
}

/// <summary>
/// Trigger leaderboard display after a specific question
/// </summary>
public async Task ShowLeaderboardAfterQuestion(string sessionCode, int questionId)
{
    var session = await _context.QuizSessions
        .FirstOrDefaultAsync(s => s.SessionCode == sessionCode);
    
    if (session == null || !session.ShowLeaderboardAfterQuestion)
        return;
    
    // Calculate and update leaderboard
    await UpdateLeaderboardForSession(session.SessionId);
    
    // Send leaderboard to all participants
    var leaderboard = await GetLeaderboardData(session.SessionId);
    
    await Clients.Group(sessionCode).SendAsync("ShowLeaderboardAfterQuestion", new
    {
        SessionCode = sessionCode,
        QuestionId = questionId,
        Leaderboard = leaderboard,
        Timestamp = DateTime.UtcNow
    });
}

/// <summary>
/// Show final leaderboard at quiz end
/// </summary>
public async Task ShowLeaderboardAtEnd(string sessionCode)
{
    var session = await _context.QuizSessions
        .FirstOrDefaultAsync(s => s.SessionCode == sessionCode);
    
    if (session == null)
        return;
    
    // Calculate final leaderboard
    await UpdateLeaderboardForSession(session.SessionId);
    
    // Send final leaderboard to all participants
    var leaderboard = await GetLeaderboardData(session.SessionId);
    
    await Clients.Group(sessionCode).SendAsync("ShowLeaderboardAtEnd", new
    {
        SessionCode = sessionCode,
        Leaderboard = leaderboard,
        Final = true,
        Timestamp = DateTime.UtcNow
    });
}

/// <summary>
/// Helper method to calculate leaderboard rankings
/// </summary>
private async Task UpdateLeaderboardForSession(int sessionId)
{
    // Get all participant answers for this session
    var participantScores = await _context.ParticipantAnswers
        .Where(pa => pa.SessionId == sessionId)
        .GroupBy(pa => pa.ParticipantId)
        .Select(g => new
        {
            ParticipantId = g.Key,
            Score = g.Count(a => a.IsCorrect),
            CorrectAnswers = g.Count(a => a.IsCorrect),
            TotalQuestions = g.Count(),
            AverageTime = g.Average(a => a.TimeToAnswer ?? 0)
        })
        .OrderByDescending(s => s.Score)
        .ThenBy(s => s.AverageTime)
        .ToListAsync();
    
    // Update or create leaderboard entries with rankings
    int rank = 1;
    foreach (var score in participantScores)
    {
        var entry = await _context.Leaderboard
            .FirstOrDefaultAsync(l => l.SessionId == sessionId && l.ParticipantId == score.ParticipantId);
        
        if (entry == null)
        {
            entry = new Leaderboard
            {
                SessionId = sessionId,
                ParticipantId = score.ParticipantId
            };
            _context.Leaderboard.Add(entry);
        }
        
        entry.Score = score.Score;
        entry.Rank = rank++;
        entry.CorrectAnswers = score.CorrectAnswers;
        entry.TotalQuestions = score.TotalQuestions;
        entry.AverageTime = (decimal)score.AverageTime;
        entry.LastUpdated = DateTime.UtcNow;
    }
    
    await _context.SaveChangesAsync();
}

/// <summary>
/// Helper method to get formatted leaderboard data
/// </summary>
private async Task<object> GetLeaderboardData(int sessionId)
{
    var entries = await _context.Leaderboard
        .Where(l => l.SessionId == sessionId)
        .Include(l => l.Participant)
        .OrderBy(l => l.Rank)
        .Select(l => new
        {
            ParticipantId = l.ParticipantId,
            ParticipantName = l.Participant.Name,
            Score = l.Score,
            Rank = l.Rank,
            CorrectAnswers = l.CorrectAnswers,
            TotalQuestions = l.TotalQuestions,
            AverageTime = l.AverageTime
        })
        .ToListAsync();
    
    return new
    {
        SessionId = sessionId,
        Entries = entries,
        TotalParticipants = entries.Count,
        Timestamp = DateTime.UtcNow
    };
}
```

## REST API Controller

### LeaderboardController.cs

Create a new controller for leaderboard HTTP endpoints:

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace YourNamespace.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LeaderboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public LeaderboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Get leaderboard for a session by ID
        /// </summary>
        [HttpGet("session/{sessionId}")]
        public async Task<IActionResult> GetLeaderboard(int sessionId)
        {
            var entries = await _context.Leaderboard
                .Where(l => l.SessionId == sessionId)
                .Include(l => l.Participant)
                .OrderBy(l => l.Rank)
                .Select(l => new
                {
                    ParticipantId = l.ParticipantId,
                    ParticipantName = l.Participant.Name,
                    Score = l.Score,
                    Rank = l.Rank,
                    CorrectAnswers = l.CorrectAnswers,
                    TotalQuestions = l.TotalQuestions,
                    AverageTime = l.AverageTime
                })
                .ToListAsync();

            var session = await _context.QuizSessions
                .FirstOrDefaultAsync(s => s.SessionId == sessionId);

            return Ok(new
            {
                SessionId = sessionId,
                SessionCode = session?.SessionCode,
                Entries = entries,
                TotalParticipants = entries.Count,
                Timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Get leaderboard by session code
        /// </summary>
        [HttpGet("session/code/{sessionCode}")]
        public async Task<IActionResult> GetLeaderboardByCode(string sessionCode)
        {
            var session = await _context.QuizSessions
                .FirstOrDefaultAsync(s => s.SessionCode == sessionCode);

            if (session == null)
                return NotFound("Session not found");

            return await GetLeaderboard(session.SessionId);
        }

        /// <summary>
        /// Get leaderboard settings for a session
        /// </summary>
        [HttpGet("settings/{sessionId}")]
        public async Task<IActionResult> GetLeaderboardSettings(int sessionId)
        {
            var session = await _context.QuizSessions
                .FirstOrDefaultAsync(s => s.SessionId == sessionId);

            if (session == null)
                return NotFound("Session not found");

            return Ok(new
            {
                SessionId = sessionId,
                ShowAfterEachQuestion = session.ShowLeaderboardAfterQuestion,
                ShowAtEndOnly = session.ShowLeaderboardAtEndOnly,
                IsVisible = session.LeaderboardVisible
            });
        }

        /// <summary>
        /// Update leaderboard settings
        /// </summary>
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateLeaderboardSettings([FromBody] LeaderboardSettingsDto settings)
        {
            var session = await _context.QuizSessions
                .FirstOrDefaultAsync(s => s.SessionId == settings.SessionId);

            if (session == null)
                return NotFound("Session not found");

            session.ShowLeaderboardAfterQuestion = settings.ShowAfterEachQuestion;
            session.ShowLeaderboardAtEndOnly = settings.ShowAtEndOnly;
            session.LeaderboardVisible = settings.IsVisible;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Settings updated successfully" });
        }

        /// <summary>
        /// Toggle leaderboard visibility
        /// </summary>
        [HttpPost("toggle-visibility")]
        public async Task<IActionResult> ToggleVisibility([FromBody] ToggleVisibilityDto dto)
        {
            var session = await _context.QuizSessions
                .FirstOrDefaultAsync(s => s.SessionId == dto.SessionId);

            if (session == null)
                return NotFound("Session not found");

            session.LeaderboardVisible = dto.IsVisible;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Visibility toggled successfully" });
        }
    }

    // DTOs
    public class LeaderboardSettingsDto
    {
        public int SessionId { get; set; }
        public bool ShowAfterEachQuestion { get; set; }
        public bool ShowAtEndOnly { get; set; }
        public bool IsVisible { get; set; }
    }

    public class ToggleVisibilityDto
    {
        public int SessionId { get; set; }
        public bool IsVisible { get; set; }
    }
}
```

## Integration Points

### 1. When Question Timer Expires

In your existing timer expiration logic, add:

```csharp
if (session.ShowLeaderboardAfterQuestion)
{
    await ShowLeaderboardAfterQuestion(sessionCode, questionId);
}
```

### 2. When Quiz Ends

In your existing `ManualEnd` or quiz end logic, add:

```csharp
if (session.ShowLeaderboardAtEndOnly)
{
    await ShowLeaderboardAtEnd(sessionCode);
}
```

### 3. After Each Answer Submission

Update leaderboard in real-time when participants submit answers:

```csharp
// After saving answer
await UpdateLeaderboardForSession(sessionId);
```

## Testing Checklist

- [ ] Database tables created with correct schema
- [ ] SignalR hub methods respond correctly
- [ ] Leaderboard calculates scores accurately
- [ ] Rankings update in real-time
- [ ] "Show After Each Question" displays leaderboard to participants
- [ ] "Show at End Only" displays final leaderboard
- [ ] Manual toggle works instantly
- [ ] Multiple sessions don't interfere with each other
- [ ] Leaderboard persists across disconnections

## Additional Notes

1. **Performance**: Consider caching leaderboard calculations for large sessions
2. **Security**: Add authentication/authorization checks to ensure only hosts can toggle settings
3. **Real-time Updates**: Leaderboard should update as participants submit answers
4. **Timing**: Ensure leaderboard displays for appropriate duration (e.g., 5-10 seconds) before auto-advancing

## Frontend Routes

Ensure these routes are configured in your Angular routing:

- `/leaderboard` - Main leaderboard view for both host and participants
- Query parameters: `sessionId`, `sessionCode`, `questionId`, `final`, `returnToQuiz`
