# Add Question Flow - Detailed Mermaid Diagrams

## 5. Complete Add Question Flow (HTML → TS → Service → API)

```mermaid
sequenceDiagram
    participant User
    participant HTML as add-question.component.html
    participant TS as AddQuestionComponent.ts
    participant Service as AddQuestionService
    participant ErrorHandler as ErrorHandlerService
    participant HTTP as HttpClient
    participant API as Backend API

    User->>HTML: Fill Quiz Name & Category
    HTML->>TS: [(ngModelChange)] triggers
    TS->>TS: Form validation
    TS->>Service: setQuizBasics(name, category)
    Service->>Service: generatePreviewQuizNumber()
    Service->>Service: Update _quizMeta signal

    User->>HTML: Fill Question Text
    HTML->>TS: Form binding updates
    TS->>TS: Reactive form validation

    User->>HTML: Select Question Type
    HTML->>TS: type.valueChanges.subscribe()
    TS->>TS: Auto-configure options for True/False
    TS->>TS: Clear options for Short Answer

    User->>HTML: Add Options
    HTML->>TS: addOption() called
    TS->>TS: Push new FormControl to options FormArray
    TS->>TS: Validate hasAtLeastTwoOptions()

    User->>HTML: Mark Correct Answer
    HTML->>TS: Checkbox change
    TS->>TS: hasAtLeastOneCorrect() validation

    User->>HTML: Click "Add Question"
    HTML->>TS: onSubmit() method
    TS->>TS: Form validation checks
    TS->>TS: Build QuizQuestion payload
    TS->>Service: addQuestionObservable(payload)
    Service->>Service: Observable-based validation
    Service->>Service: Normalize data with error handling
    Service->>Service: Update _questions signal
    Service->>TS: Observable completion
    TS->>TS: resetForm() - clear question fields

    Note over Service,TS: Error Handling with RxJS
    Service->>ErrorHandler: handleObservableError if needed
    ErrorHandler->>TS: User-friendly error message
    TS->>HTML: Display error or success state

    User->>HTML: Click "Create Quiz"
    HTML->>TS: publishFromPreview()
    TS->>TS: Validate 1-25 questions
    TS->>TS: Show confirmation dialog
    TS->>Service: createQuizObservable()
    Service->>Service: Build backend payload
    Service->>HTTP: Observable HTTP POST /api/Host/Quiz/CreateBulk
    HTTP->>API: HTTP Request with timeout & retry

    alt Success Path
        API-->>HTTP: Response {quizId, quizNumber, questionCount}
        HTTP-->>Service: Observable success
        Service->>Service: Update loading states
        Service-->>TS: CreateQuizResponse Observable
        TS->>TS: Set success signals
        TS->>HTML: Display QR code & success message
    else Error Path
        API-->>HTTP: Error Response
        HTTP-->>Service: Observable error
        Service->>ErrorHandler: handleHttpError with retry logic
        ErrorHandler->>Service: Formatted error message
        Service-->>TS: Observable error
        TS->>TS: Handle error state
        TS->>HTML: Display error message
    end
```

## 6. Form Validation & Method Flow

```mermaid
flowchart TD
    A[User Interaction] --> B{Form Event Type}

    B -->|Input Change| C[Reactive Form Binding]
    B -->|Type Selection| D[type.valueChanges]
    B -->|Add Option| E[addOption()]
    B -->|Remove Option| F[removeOption()]
    B -->|Submit Question| G[onSubmit()]
    B -->|Create Quiz| H[publishFromPreview()]

    C --> I[Form Validation]
    I --> J{Valid?}
    J -->|Yes| K[Enable UI Controls]
    J -->|No| L[Show Error States]

    D --> M[Question Type Logic]
    M --> N{Type Check}
    N -->|Multiple Choice| O[Ensure 2+ options]
    N -->|True/False| P[Auto-create True/False options]
    N -->|Short Answer| Q[Clear all options]

    E --> R[FormArray.push()]
    R --> S[Update Options Display]

    F --> T[FormArray.removeAt()]
    T --> U[Validate Remaining Options]

    G --> V[Validation Chain]
    V --> W[hasAtLeastTwoOptions()]
    W --> X[hasAtLeastOneCorrect()]
    X --> Y{All Valid?}
    Y -->|Yes| Z[Build QuizQuestion Payload]
    Y -->|No| AA[Show Validation Errors]

    Z --> BB[store.addQuestion()]
    BB --> CC[resetForm()]

    H --> DD[Final Validation]
    DD --> EE[Question Count Check]
    EE --> FF{1-25 Questions?}
    FF -->|Yes| GG[Confirmation Dialog]
    FF -->|No| HH[Show Error Message]

    GG --> II{User Confirms?}
    II -->|Yes| JJ[store.createQuiz()]
    II -->|No| KK[Cancel Operation]

    JJ --> LL[API Call Chain]
    LL --> MM[Success/Error Handling]

    style A fill:#ffeb3b
    style G fill:#4caf50
    style H fill:#2196f3
    style JJ fill:#ff5722
```

## 7. AddQuestionService Internal Flow

```mermaid
flowchart TD
    A[Service Methods] --> B{Method Called}

    B -->|setQuizBasics| C[setQuizBasics Flow]
    B -->|addQuestion| D[addQuestion Observable Flow]
    B -->|createQuiz| E[createQuiz Observable Flow]
    B -->|removeQuestion| F[removeQuestion Flow]
    B -->|CSV Import| G[CSV Import Observable Flow]

    C --> C1[Validate name & category]
    C1 --> C2[generatePreviewQuizNumber()]
    C2 --> C3[Update _quizMeta signal]
    C3 --> C4[Error handling with try/catch]

    D --> D1[Observable-based validation]
    D1 --> D2[setLoading(true)]
    D2 --> D3[Normalize payload data]
    D3 --> D4[Update _questions signal]
    D4 --> D5[Observable completion]
    D5 --> D6[setLoading(false)]
    D --> D7{Error Occurred?}
    D7 -->|Yes| D8[handleError() method]
    D7 -->|No| D9[Success Observable]

    E --> E1{Validation Check}
    E1 -->|Quiz meta missing| E2[Observable Error]
    E1 -->|No questions| E3[Observable Error]
    E1 -->|Wrong count| E4[Observable Error]
    E1 -->|Valid| E5[Map to Backend Format]

    E5 --> E6[Build API Payload]
    E6 --> E7[HTTP POST Observable with timeout]
    E7 --> E8{Observable Response}
    E8 -->|Success| E9[Return CreateQuizResponse Observable]
    E8 -->|Error| E10[RxJS Error Handling Pipeline]

    E10 --> E11[retryWithBackoff operator]
    E11 --> E12[catchError operator]
    E12 --> E13[finalize for cleanup]
    E13 --> E14[User-friendly error messages]

    F --> F1[Update _questions signal]
    F1 --> F2[Filter out removed question]

    G --> G1[File validation Observable]
    G1 --> G2[CSV parsing Observable]
    G2 --> G3[Question mapping Observable]
    G3 --> G4{Parsing Success?}
    G4 -->|Yes| G5[Update questions array]
    G4 -->|No| G6[Observable error with details]

    style E fill:#ff9800
    style E10 fill:#f44336
    style D8 fill:#ff5722
    style E11 fill:#2196f3
    style G1 fill:#4caf50
```

## 8. API Integration & Error Handling

```mermaid
sequenceDiagram
    participant Service as AddQuestionService
    participant ErrorHandler as ErrorHandlerService
    participant HTTP as HttpClient
    participant Proxy as Angular Proxy
    participant Backend as ASP.NET API

    Service->>Service: createQuizObservable() called
    Service->>Service: Validate quiz data
    Service->>Service: Map to backend format
    Service->>Service: Set loading state

    Note over Service: Transform: questionType "MCQ" → "Multiple Choice"
    Note over Service: Add defaults: difficulty, timeLimit, createdBy

    Service->>HTTP: Observable HTTP POST with timeout(10000)
    HTTP->>Proxy: /api/Host/Quiz/CreateBulk
    Proxy->>Backend: http://localhost:5195/api/Host/Quiz/CreateBulk

    alt Backend Available & Endpoint Exists
        Backend-->>Proxy: JSON Response
        Proxy-->>HTTP: JSON Response
        HTTP-->>Service: Observable success
        Service->>Service: Update signals with success data
        Service->>Service: Set loading(false)
        Note over Service: Observable completes successfully

    else Network/Connection Error
        Backend-->>Proxy: Connection Error
        Proxy-->>HTTP: Network Error
        HTTP-->>Service: Observable error
        Service->>ErrorHandler: retryWithBackoff(2, 1000)
        ErrorHandler->>HTTP: Retry with exponential backoff
        alt Retry Success
            HTTP-->>Service: Observable success
        else Retry Failed
            HTTP-->>Service: Final Observable error
            Service->>Service: Set error state & loading(false)
        end

    else Endpoint Not Found (404)
        Backend-->>Proxy: HTML 404 Page
        Proxy-->>HTTP: HTML Response
        HTTP-->>Service: Observable error
        Service->>ErrorHandler: handleHttpError(404)
        ErrorHandler->>Service: "Endpoint not found" message
        Service->>Service: Set specific error state

    else Server Error (500)
        Backend-->>Proxy: JSON Error Response
        Proxy-->>HTTP: JSON Error
        HTTP-->>Service: Observable error
        Service->>ErrorHandler: handleHttpError(500)
        ErrorHandler->>Service: "Server error" message
        Service->>Service: Set error state with retry option

    else Timeout Error
        Note over HTTP: 10 second timeout exceeded
        HTTP-->>Service: TimeoutError Observable
        Service->>ErrorHandler: handleObservableError('timeout')
        ErrorHandler->>Service: "Request timed out" message
        Service->>Service: Set timeout error state
    end

    Note over Service: All errors logged with full context
    Note over Service: Loading states managed throughout
    Note over Service: User-friendly error messages provided
    Note over Service: Observable cleanup with finalize operator
```

## 9. Component State Management (Angular Signals)

```mermaid
stateDiagram-v2
    [*] --> Initial
    Initial --> QuizBasicsSet : setQuizBasics()

    QuizBasicsSet --> QuestionAdded : addQuestion()
    QuestionAdded --> QuestionAdded : addQuestion() (multiple)
    QuestionAdded --> QuestionRemoved : removeQuestion()
    QuestionRemoved --> QuestionAdded : addQuestion()

    QuestionAdded --> QuizCreating : createQuiz()
    QuizCreating --> QuizCreated : API Success
    QuizCreating --> QuizError : API Error

    QuizError --> QuestionAdded : Retry
    QuizCreated --> [*] : clearAll()

    state "Quiz Basics Set" as QuizBasicsSet {
        _quizMeta: signal<QuizMeta>
        quizNumber: Preview Generated
        quizName: User Input
        category: User Input
    }

    state "Question Added" as QuestionAdded {
        _questions: signal<QuizQuestion[]>
        Live Preview Updates
        Form Reset After Add
    }

    state "Quiz Creating" as QuizCreating {
        API Call in Progress
        Loading State
        Validation Complete
    }

    state "Quiz Created" as QuizCreated {
        Success Response
        QR Code Generated
        Quiz Number Assigned
        createdQuizNumber: signal
        isQuizCreated: signal
    }
```
