# CTS Quiz Application - Mermaid Diagrams

## 1. Application Startup & Navigation Flow

```mermaid
graph TD
    A[Application Start] --> B[main.ts]
    B --> C[app.component.ts]
    C --> D{Route Resolution}

    D --> E[Default Route '/']
    E --> F[Redirects to 'host/addquestion']
    F --> G[QuizTabsComponent]

    D --> H['/participant']
    H --> I[ParticipantPageComponent]

    D --> J['/countdown']
    J --> K[CountdownComponent]

    D --> L['/quiz']
    L --> M[QuizPageComponent]

    D --> N['/lobby']
    N --> O[QuizUsernameComponent]

    G --> P{Quiz Tab Navigation}
    P --> Q[Questions Tab - AddQuestionComponent]
    P --> R[Preview Tab - PreviewComponent]
    P --> S[Publish Tab - PublishquizComponent]
    P --> T[Results Tab - ResultComponent]

    Q --> U[HeaderComponent]
    Q --> V[NavigationComponent]
    Q --> W[QuestionComponent]
    Q --> X[OptionsComponent]
    Q --> Y[QrcodeComponent]

    style A fill:#ff9999
    style G fill:#99ccff
    style Q fill:#99ff99
    style I fill:#ffcc99
```

## 2. Quiz Host Flow - Component Hierarchy

```mermaid
graph TD
    A[QuizTabsComponent] --> B[Questions Tab Active]
    B --> C[AddQuestionComponent]

    C --> D[HeaderComponent]
    C --> E[Form Components]
    C --> F[QrcodeComponent]

    E --> G[Quiz Name Input]
    E --> H[Question Text Input]
    E --> I[Question Type Select]
    E --> J[Difficulty Select]
    E --> K[Category Input]
    E --> L[Timer Input]
    E --> M[Tags Input]
    E --> N[Options Array]

    N --> O[OptionsComponent]
    O --> P[Option Text Input]
    O --> Q[Correct Answer Checkbox]

    A --> R[Preview Tab]
    R --> S[PreviewComponent]

    A --> T[Publish Tab]
    T --> U[PublishquizComponent]

    A --> V[Results Tab]
    V --> W[ResultComponent]

    style A fill:#e1f5fe
    style C fill:#f3e5f5
    style O fill:#fff3e0
```

## 3. Participant Flow

```mermaid
graph TD
    A[Participant Enters] --> B[ParticipantPageComponent]
    B --> C[Enter Quiz Code]
    B --> D[Enter Username]
    B --> E[Join Quiz Button]

    E --> F[Validation]
    F --> G{Valid?}
    G -->|Yes| H[Redirect to Lobby]
    G -->|No| I[Show Error Message]

    H --> J[QuizUsernameComponent]
    J --> K[Wait for Quiz Start]
    K --> L[Countdown]

    L --> M[CountdownComponent]
    M --> N[3...2...1... Timer]
    N --> O[Redirect to Quiz]

    O --> P[QuizPageComponent]
    P --> Q[Question Display]
    P --> R[Answer Selection]
    P --> S[Submit Answer]
    P --> T[Next Question]

    T --> U{More Questions?}
    U -->|Yes| Q
    U -->|No| V[Quiz Complete]

    style A fill:#ffebee
    style B fill:#e8f5e8
    style M fill:#fff8e1
    style P fill:#e1f5fe
```

## 4. Service Layer Architecture with RxJS Error Handling

```mermaid
graph TD
    A[Angular Components] --> B[AddQuestionService]
    B --> C[HTTP Client with Observables]
    C --> D[Proxy Configuration]
    D --> E[Backend API Endpoints]

    B --> F[Signal-based State Management]
    F --> G[Quiz Meta Signal]
    F --> H[Questions Array Signal]
    F --> I[Loading State Signals]
    F --> J[Error State Signals]

    B --> K[Core Observable Methods]
    K --> L[setQuizBasics() with validation]
    K --> M[addQuestionObservable()]
    K --> N[createQuizObservable()]
    K --> O[removeQuestion() with state]
    K --> P[updateQuestion()]
    K --> Q[clearAll()]

    B --> R[API Integration with Error Handling]
    R --> S[createQuizObservable() - POST with retry]
    R --> T[getHostQuizzes() - GET with timeout]
    R --> U[getQuizForEdit() - GET with validation]
    R --> V[updateQuiz() - PUT with error recovery]
    R --> W[deleteQuiz() - DELETE with confirmation]
    R --> X[publishQuiz() - POST with loading states]

    B --> Y[Enhanced Utility Features]
    Y --> Z[CSV Import/Export with Observable validation]
    Y --> AA[Quiz Number Generation]
    Y --> BB[Observable Data Validation]
    Y --> CC[Form Validation Service Integration]

    %% Error Handling Integration
    B --> DD[ErrorHandlerService Integration]
    DD --> EE[centralized error processing]
    DD --> FF[retry logic with backoff]
    DD --> GG[user-friendly error messages]
    DD --> HH[loading state management]

    %% RxJS Operators Pipeline
    S --> II[Observable Pipeline]
    II --> JJ[timeout operator]
    II --> KK[retryWhen with backoff]
    II --> LL[catchError handler]
    II --> MM[finalize cleanup]

    style B fill:#e8f5e8
    style F fill:#fff3e0
    style K fill:#f3e5f5
    style R fill:#e1f5fe
    style DD fill:#ffebee
    style II fill:#f0f4c3
```
