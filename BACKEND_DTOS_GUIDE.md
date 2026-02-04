# Backend DTOs for Quiz Publishing System

## 📋 Recommended Backend DTOs

### 1. **CreateQuizSessionDto** (For creating/publishing a quiz session)
```csharp
namespace cts_quiz_backend.DTOs.Session
{
    public class CreateQuizSessionDto
    {
        public int QuizId { get; set; }
        public string HostId { get; set; }
        public string QuizNumber { get; set; } // This will be the SessionCode
        public string? ScheduledTime { get; set; }
    }
}
```

### 2. **QuizSessionResponseDto** (Response after creating session)
```csharp
namespace cts_quiz_backend.DTOs.Session
{
    public class QuizSessionResponseDto
    {
        public int SessionId { get; set; }
        public int QuizId { get; set; }
        public string HostId { get; set; }
        public string SessionCode { get; set; } // This is QuizNumber
        public DateTime StartedAt { get; set; }
        public string Status { get; set; } // "LIVE", "DRAFT", "COMPLETED"
        public int ParticipantCount { get; set; }
    }
}
```

### 3. **UpdateQuizSessionStatusDto** (For status changes)
```csharp
namespace cts_quiz_backend.DTOs.Session
{
    public class UpdateQuizSessionStatusDto
    {
        public string SessionCode { get; set; } // QuizNumber
        public string Status { get; set; } // "LIVE", "COMPLETED", "DRAFT"
    }
}
```

### 4. **QuizPublishRequestDto** (Combined publish request)
```csharp
namespace cts_quiz_backend.DTOs.Publish
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

### 5. **QuizPublishResponseDto** (Combined publish response)
```csharp
namespace cts_quiz_backend.DTOs.Publish
{
    public class QuizPublishResponseDto
    {
        public int PublishId { get; set; }
        public int SessionId { get; set; }
        public int QuizId { get; set; }
        public string QuizNumber { get; set; }
        public string PublishedBy { get; set; }
        public DateTime PublishedAt { get; set; }
        public string SessionCode { get; set; } // Same as QuizNumber
        public string Status { get; set; } // "LIVE"
    }
}
```

### 6. **SessionParticipantDto** (For participant tracking)
```csharp
namespace cts_quiz_backend.DTOs.Session
{
    public class SessionParticipantDto
    {
        public int ParticipantId { get; set; }
        public string SessionCode { get; set; }
        public string ParticipantName { get; set; }
        public DateTime JoinedAt { get; set; }
    }
}
```

---

## 🔧 Backend Controller Methods

### **QuizSessionController.cs**
```csharp
[ApiController]
[Route("api/[controller]")]
public class QuizSessionController : ControllerBase
{
    private readonly IQuizSessionService _sessionService;

    [HttpPost("publish")]
    public async Task<ActionResult<QuizPublishResponseDto>> PublishQuiz(QuizPublishRequestDto request)
    {
        // 1. Create QuizSession with SessionCode = QuizNumber
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
        
        var createdSession = await _sessionService.CreateSessionAsync(session);
        
        // 2. Create Publish record
        var publish = new Publish
        {
            QuizId = request.QuizId,
            PublishedBy = request.PublishedBy,
            PublishedAt = DateTime.UtcNow,
            QuizNumber = request.QuizNumber,
            SessionId = createdSession.SessionId
        };
        
        await _publishService.CreatePublishAsync(publish);
        
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
            SessionId = createdSession.SessionId,
            QuizId = request.QuizId,
            QuizNumber = request.QuizNumber,
            PublishedBy = request.PublishedBy,
            PublishedAt = publish.PublishedAt.Value,
            SessionCode = request.QuizNumber,
            Status = "LIVE"
        });
    }

    [HttpPost("unpublish")]
    public async Task<ActionResult> UnpublishQuiz(string quizNumber)
    {
        var session = await _sessionService.GetSessionByCodeAsync(quizNumber);
        if (session == null) return NotFound();
        
        session.Status = "DRAFT";
        session.EndedAt = DateTime.UtcNow;
        await _sessionService.UpdateSessionAsync(session);
        
        return Ok();
    }

    [HttpPost("complete")]
    public async Task<ActionResult> CompleteQuiz(string quizNumber)
    {
        var session = await _sessionService.GetSessionByCodeAsync(quizNumber);
        if (session == null) return NotFound();
        
        session.Status = "COMPLETED";
        session.EndedAt = DateTime.UtcNow;
        await _sessionService.UpdateSessionAsync(session);
        
        await _hubContext.Clients.Group($"Quiz_{quizNumber}")
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
        var session = await _sessionService.GetSessionByCodeAsync(quizNumber);
        if (session == null) return NotFound();
        
        var count = session.Participants.Count;
        return Ok(count);
    }
}
```

---

## 📊 Database Mapping

### QuizSession Model Updates
```csharp
public partial class QuizSession
{
    public int SessionId { get; set; }
    public int? QuizId { get; set; }
    public string? HostId { get; set; }
    public string? SessionCode { get; set; } // Maps to QuizNumber
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? Status { get; set; } // "DRAFT", "LIVE", "COMPLETED"

    // Navigation properties
    public virtual ICollection<Participant> Participants { get; set; } = new List<Participant>();
    public virtual ICollection<Publish> Publishes { get; set; } = new List<Publish>();
    public virtual ICollection<SessionQuestion> SessionQuestions { get; set; } = new List<SessionQuestion>();
}
```

### Publish Model
```csharp
public partial class Publish
{
    public int PublishId { get; set; }
    public int? QuizId { get; set; }
    public int? QuestionId { get; set; }
    public string? PublishedBy { get; set; }
    public DateTime? PublishedAt { get; set; }
    public int? QuizNumber { get; set; }
    public int? SessionId { get; set; } // Add this FK
    
    public virtual QuizSession? Session { get; set; }
}
```

---

## 🔄 API Endpoints Required

1. **POST** `/api/QuizSession/publish` - Publish a quiz (create session)
2. **POST** `/api/QuizSession/unpublish` - Unpublish quiz (set to DRAFT)
3. **POST** `/api/QuizSession/complete` - Complete quiz session
4. **GET** `/api/QuizSession/{quizNumber}/participants/count` - Get participant count
5. **GET** `/api/QuizSession/{quizNumber}` - Get session details
6. **GET** `/api/QuizSession/host/{hostId}` - Get all sessions for a host

---

## 🎯 Key Mappings

- **SessionCode** ↔ **QuizNumber** (Same value, used interchangeably)
- **Status Values**: "DRAFT", "LIVE", "COMPLETED"
- **HostId** ↔ **PublishedBy** (Same user identifier)

---

## 📝 Notes

1. When a quiz is published, create both a `QuizSession` and a `Publish` record
2. Use `SessionCode` field in `QuizSession` to store the `QuizNumber`
3. Participants join using `SessionCode` (which is the `QuizNumber`)
4. Update quiz status in both `QuizSession.Status` and notify via SignalR
5. Track all participants in the `Participants` collection linked to `SessionId`
