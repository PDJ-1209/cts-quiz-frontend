# Quiz Publishing Integration Summary

## ✅ What I've Done (Frontend)

### 1. **Created Backend DTOs Guide** (`BACKEND_DTOS_GUIDE.md`)
   - Complete DTOs for your C# backend
   - Controller methods with SignalR integration
   - Database mapping guidelines

### 2. **Updated Models** (`quiz-publish.models.ts`)
   - Added `QuizPublishRequest` - matches your backend DTO
   - Added `QuizPublishResponse` - for backend responses
   - Mapped `SessionCode` ↔ `QuizNumber`

### 3. **Updated Quiz Publish Service** (`quiz-publish.service.ts`)
   - Now calls backend REST API endpoints
   - SignalR for real-time updates only
   - Proper payload structure matching your DTOs

### 4. **Updated Result Component** (`result.component.ts`)
   - Integrated with `QuizPublishService`
   - Real-time updates via SignalR subscriptions
   - Scheduled time support
   - Proper error handling and notifications

---

## 🎯 Backend Implementation Needed

### Step 1: Create DTOs

Create these files in your backend:

**`DTOs/Session/QuizPublishRequestDto.cs`**
```csharp
namespace cts_quiz_backend.DTOs.Session
{
    public class QuizPublishRequestDto
    {
        public int QuizId { get; set; }
        public string QuizNumber { get; set; }
        public string PublishedBy { get; set; }
        public string? ScheduledTime { get; set; }
    }
}
```

**`DTOs/Session/QuizPublishResponseDto.cs`**
```csharp
namespace cts_quiz_backend.DTOs.Session
{
    public class QuizPublishResponseDto
    {
        public int PublishId { get; set; }
        public int SessionId { get; set; }
        public int QuizId { get; set; }
        public string QuizNumber { get; set; }
        public string PublishedBy { get; set; }
        public DateTime PublishedAt { get; set; }
        public string SessionCode { get; set; }
        public string Status { get; set; }
    }
}
```

### Step 2: Update Database Models

**Add to `Publish` model:**
```csharp
public int? SessionId { get; set; }
public virtual QuizSession? Session { get; set; }
```

**Ensure `QuizSession` has:**
```csharp
public string? SessionCode { get; set; } // This stores the QuizNumber
```

### Step 3: Create QuizSessionController

```csharp
[ApiController]
[Route("api/[controller]")]
public class QuizSessionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IHubContext<QuizHub> _hubContext;

    public QuizSessionController(ApplicationDbContext context, IHubContext<QuizHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    [HttpPost("publish")]
    public async Task<ActionResult<QuizPublishResponseDto>> PublishQuiz([FromBody] QuizPublishRequestDto request)
    {
        // 1. Create QuizSession
        var session = new QuizSession
        {
            QuizId = request.QuizId,
            HostId = request.PublishedBy,
            SessionCode = request.QuizNumber, // Map QuizNumber to SessionCode
            StartedAt = string.IsNullOrEmpty(request.ScheduledTime) 
                ? DateTime.UtcNow 
                : DateTime.Parse(request.ScheduledTime),
            Status = "LIVE"
        };
        
        _context.QuizSessions.Add(session);
        await _context.SaveChangesAsync();
        
        // 2. Create Publish record
        var publish = new Publish
        {
            QuizId = request.QuizId,
            PublishedBy = request.PublishedBy,
            PublishedAt = DateTime.UtcNow,
            QuizNumber = int.Parse(request.QuizNumber.Replace("QZ", "")),
            SessionId = session.SessionId
        };
        
        _context.Publishes.Add(publish);
        await _context.SaveChangesAsync();
        
        // 3. Notify via SignalR
        await _hubContext.Clients.Group($"Host_{request.PublishedBy}")
            .SendAsync("QuizPublished", new 
            {
                quizId = request.QuizId,
                quizNumber = request.QuizNumber,
                status = "LIVE",
                sessionCode = request.QuizNumber,
                publishedAt = DateTime.UtcNow
            });
        
        return Ok(new QuizPublishResponseDto
        {
            PublishId = publish.PublishId,
            SessionId = session.SessionId,
            QuizId = request.QuizId,
            QuizNumber = request.QuizNumber,
            PublishedBy = request.PublishedBy,
            PublishedAt = publish.PublishedAt.Value,
            SessionCode = request.QuizNumber,
            Status = "LIVE"
        });
    }

    [HttpPost("unpublish")]
    public async Task<ActionResult> UnpublishQuiz([FromBody] dynamic body)
    {
        string quizNumber = body.quizNumber;
        var session = await _context.QuizSessions
            .FirstOrDefaultAsync(s => s.SessionCode == quizNumber);
            
        if (session == null) return NotFound();
        
        session.Status = "DRAFT";
        session.EndedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        
        await _hubContext.Clients.Group($"Host_{session.HostId}")
            .SendAsync("QuizStatusChanged", new 
            {
                quizNumber,
                status = "DRAFT",
                timestamp = DateTime.UtcNow
            });
        
        return Ok();
    }

    [HttpPost("complete")]
    public async Task<ActionResult> CompleteQuiz([FromBody] dynamic body)
    {
        string quizNumber = body.quizNumber;
        var session = await _context.QuizSessions
            .FirstOrDefaultAsync(s => s.SessionCode == quizNumber);
            
        if (session == null) return NotFound();
        
        session.Status = "COMPLETED";
        session.EndedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        
        await _hubContext.Clients.All
            .SendAsync("QuizSessionEnded", new 
            {
                quizNumber,
                endedAt = DateTime.UtcNow
            });
        
        return Ok();
    }

    [HttpGet("{quizNumber}/participants/count")]
    public async Task<ActionResult<int>> GetParticipantCount(string quizNumber)
    {
        var session = await _context.QuizSessions
            .Include(s => s.Participants)
            .FirstOrDefaultAsync(s => s.SessionCode == quizNumber);
            
        if (session == null) return NotFound();
        
        return Ok(session.Participants.Count);
    }
}
```

### Step 4: Update SignalR Hub

```csharp
public class QuizHub : Hub
{
    public async Task JoinHostGroup(string hostId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Host_{hostId}");
        Console.WriteLine($"Host {hostId} joined group");
    }

    public async Task JoinQuizSession(string quizNumber)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"Quiz_{quizNumber}");
        Console.WriteLine($"User joined quiz {quizNumber}");
    }
}
```

---

## 🔄 How It Works Now

### Publishing Flow:

1. **User clicks "Publish" button** in Result component
2. **Frontend calls** `POST /api/QuizSession/publish` with:
   ```json
   {
     "quizId": 123,
     "quizNumber": "QZ001",
     "publishedBy": "2463579",
     "scheduledTime": "2026-02-10T14:00:00Z"
   }
   ```
3. **Backend creates**:
   - `QuizSession` record with `SessionCode = "QZ001"`
   - `Publish` record linked to session
4. **Backend notifies** via SignalR → `QuizPublished` event
5. **Frontend receives** real-time update and refreshes quiz list

### Republishing Flow:

1. Click "Republish" → calls `unpublish` then `publish`
2. Updates session status to DRAFT then back to LIVE

### Session Code Mapping:

- `QuizNumber` (e.g., "QZ001") = `SessionCode` in database
- Participants join using this code
- All tracking uses `SessionCode`

---

## 📊 Data Flow

```
Result Component (User clicks Publish)
    ↓
QuizPublishService.publishQuiz()
    ↓
HTTP POST → /api/QuizSession/publish
    ↓
Backend creates Session + Publish records
    ↓
SignalR broadcasts to host group
    ↓
Frontend receives QuizPublished event
    ↓
UI updates with success message
```

---

## ✨ Features Implemented

✅ Publish quiz with scheduled time  
✅ Republish existing quizzes  
✅ Real-time status updates via SignalR  
✅ Participant count tracking  
✅ Session management  
✅ Proper error handling  
✅ Success/error notifications  
✅ Automatic quiz list refresh  

---

## 🧪 Testing

1. Start backend API
2. Run frontend: `ng serve`
3. Navigate to Result component
4. Click "Publish" on a draft quiz
5. Check:
   - ✅ Quiz status changes to LIVE
   - ✅ Success notification appears
   - ✅ Quiz list refreshes
   - ✅ Backend creates Session and Publish records

---

## 📝 Environment Variables

Ensure `environment.ts` has:
```typescript
export const environment = {
  apiUrl: 'http://localhost:5186/api',
  signalRUrl: 'http://localhost:5186/hubs'
};
```

---

## 🔑 Key Points

- **SessionCode = QuizNumber** (same value, stored in DB)
- Backend handles both API calls and SignalR
- Frontend uses HTTP for actions, SignalR for notifications
- All participants join using `SessionCode` (QuizNumber)
- Status values: "DRAFT", "LIVE", "COMPLETED"
