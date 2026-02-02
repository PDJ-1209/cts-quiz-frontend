# Component Interactions & API Mapping

## 10. Complete Component Interaction Map

```mermaid
graph TB
    subgraph "Application Shell"
        App[app.component.ts]
        Router[Angular Router]
        App --> Router
    end

    subgraph "Host Flow Components"
        QT[QuizTabsComponent] --> AQ[AddQuestionComponent]
        QT --> PV[PreviewComponent]
        QT --> PQ[PublishquizComponent]
        QT --> RS[ResultComponent]

        AQ --> H[HeaderComponent]
        AQ --> N[NavigationComponent]
        AQ --> Q[QuestionComponent]
        AQ --> O[OptionsComponent]
        AQ --> QR[QrcodeComponent]
    end

    subgraph "Participant Flow Components"
        PP[ParticipantPageComponent]
        QU[QuizUsernameComponent]
        CD[CountdownComponent]
        QP[QuizPageComponent]

        PP --> QU
        QU --> CD
        CD --> QP
    end

    subgraph "Services Layer"
        AQS[AddQuestionService]
        PS[ParticipantService]
        HTTP[HttpClient]

        AQS --> HTTP
        PS --> HTTP
    end

    subgraph "Backend APIs"
        API1["/api/Host/Quiz/CreateBulk"]
        API2["/api/Host/Quiz/List"]
        API3["/api/Host/Quiz/{id}"]
        API4["/api/Participate/Join"]
        API5["/api/Participate/Submit"]

        HTTP --> API1
        HTTP --> API2
        HTTP --> API3
        HTTP --> API4
        HTTP --> API5
    end

    Router --> QT
    Router --> PP
    Router --> QU
    Router --> CD
    Router --> QP

    AQ --> AQS
    PV --> AQS
    PQ --> AQS
    PP --> PS
    QP --> PS

    style QT fill:#e3f2fd
    style AQ fill:#f3e5f5
    style AQS fill:#e8f5e8
    style HTTP fill:#fff3e0
```

## 11. Method Mapping - Component to Service to API

```mermaid
flowchart LR
    subgraph "AddQuestionComponent Methods"
        CM1[setQuizName()]
        CM2[onSubmit()]
        CM3[addOption()]
        CM4[removeOption()]
        CM5[publishFromPreview()]
        CM6[deleteQuestion()]
        CM7[importCSV()]
        CM8[exportCSV()]
    end

    subgraph "AddQuestionService Methods"
        SM1[setQuizBasics()]
        SM2[addQuestion()]
        SM3[removeQuestion()]
        SM4[updateQuestion()]
        SM5[createQuiz()]
        SM6[getHostQuizzes()]
        SM7[getQuizForEdit()]
        SM8[updateQuiz()]
        SM9[deleteQuiz()]
        SM10[publishQuiz()]
        SM11[importFromCSV()]
        SM12[exportToCSV()]
    end

    subgraph "API Endpoints"
        API1[POST /api/Host/Quiz/CreateBulk]
        API2[GET /api/Host/Quiz/List]
        API3[GET /api/Host/Quiz/{id}]
        API4[PUT /api/Host/Quiz/{id}]
        API5[DELETE /api/Host/Quiz/{id}]
        API6[POST /api/Host/Quiz/{id}/Publish]
    end

    CM1 --> SM1
    CM2 --> SM2
    CM5 --> SM5
    CM6 --> SM3
    CM7 --> SM11
    CM8 --> SM12

    SM5 --> API1
    SM6 --> API2
    SM7 --> API3
    SM8 --> API4
    SM9 --> API5
    SM10 --> API6

    style CM5 fill:#ff5722
    style SM5 fill:#ff9800
    style API1 fill:#f44336
```

## 12. Data Flow - Forms to API Payload

```mermaid
sequenceDiagram
    participant Form as Reactive Forms
    participant Component as AddQuestionComponent
    participant Service as AddQuestionService
    participant Mapper as Data Mapper
    participant API as Backend API

    Note over Form,API: Quiz Creation Flow

    Form->>Component: Quiz Name Input
    Component->>Service: setQuizBasics(name, category)
    Service->>Service: generatePreviewQuizNumber()

    Form->>Component: Question Form Submit
    Component->>Component: Form Validation
    Component->>Service: addQuestion(QuizQuestion)
    Service->>Service: Normalize & Store in Signal

    Component->>Service: createQuiz()
    Service->>Mapper: Map Frontend → Backend Format

    Note over Mapper: Transform Data Structure
    Mapper->>Mapper: quizName → quizTitle
    Mapper->>Mapper: type "Multiple Choice" → questionType "MCQ"
    Mapper->>Mapper: Add defaults (difficulty, timeLimit, createdBy)

    Service->>API: POST /api/Host/Quiz/CreateBulk
    API-->>Service: Response {quizId, quizNumber, questionCount}
    Service->>Component: Success/Error Response
    Component->>Form: Update UI State

    Note over Form,API: Data Transformation Examples:
    Note over Form,API: Frontend: {text, type, options: [{text, isCorrect}]}
    Note over Form,API: Backend: {questionText, questionType, options: [{optionText, isCorrect}]}
```

## 13. Form Validation Chain

```mermaid
flowchart TD
    A[User Input] --> B[Reactive Form Validators]

    B --> C{Field Validation}
    C -->|Quiz Name| D[Validators.required]
    C -->|Category| E[Validators.required]
    C -->|Question Text| F[Validators.required, Validators.minLength(10)]
    C -->|Timer| G[Validators.min(0)]
    C -->|Options| H[Custom Validation Chain]

    H --> I[hasAtLeastTwoOptions()]
    I --> J{Type Check}
    J -->|Multiple Choice| K[≥ 2 options required]
    J -->|True/False| L[Exactly 2 options required]
    J -->|Short Answer| M[0 options allowed]

    H --> N[hasAtLeastOneCorrect()]
    N --> O[Check isCorrect flags]
    O --> P{At least one true?}
    P -->|Yes| Q[Valid]
    P -->|No| R[Invalid - Show Error]

    B --> S[Form State]
    S --> T{form.valid}
    T -->|True| U[Enable Submit Button]
    T -->|False| V[Disable Submit Button]
    T -->|False| W[Show Error Messages]

    style A fill:#e3f2fd
    style H fill:#fff3e0
    style T fill:#e8f5e8
```

## 14. Error Handling Flow

```mermaid
flowchart TD
    A[API Call] --> B{Response Type}

    B -->|Success JSON| C[Parse Response]
    B -->|Error JSON| D[Extract Error Message]
    B -->|HTML Response| E[Detect 404 Page]
    B -->|Network Error| F[Connection Failed]

    C --> G[Update Success State]
    G --> H[Show Success Message]
    G --> I[Generate QR Code]
    G --> J[Update Component Signals]

    D --> K[Format Error Message]
    K --> L[Show Error Alert]
    K --> M[Log to Console]

    E --> N[Backend Endpoint Missing]
    N --> O[Return Mock Response]
    O --> P[Show Development Warning]

    F --> Q[Network/Proxy Issue]
    Q --> R[Show Connection Error]
    Q --> S[Log Full Error Context]

    M --> T[Console Log Details]
    T --> U[Error Status]
    T --> V[Error URL]
    T --> W[Full Response Body]
    T --> X[Request Headers]

    style A fill:#2196f3
    style D fill:#ff5722
    style E fill:#ff9800
    style F fill:#f44336
    style O fill:#9c27b0
```

## 15. Signal-Based State Management

```mermaid
stateDiagram-v2
    [*] --> EmptyState

    state EmptyState {
        _quizMeta: null
        _questions: []
        isQuizCreated: false
        createdQuizNumber: ''
    }

    EmptyState --> BasicsFilled : setQuizBasics()

    state BasicsFilled {
        _quizMeta: {quizNumber, quizName, category}
        _questions: []
        Preview Quiz Number Generated
    }

    BasicsFilled --> QuestionsAdded : addQuestion()

    state QuestionsAdded {
        _questions: QuizQuestion[]
        Live Preview Updates
        Form Validation Active
    }

    QuestionsAdded --> QuestionsAdded : addQuestion()
    QuestionsAdded --> QuizPublished : createQuiz()
    QuestionsAdded --> EmptyState : clearAll()

    state QuizPublished {
        isQuizCreated: true
        createdQuizNumber: server assigned
        createdQuizId: server assigned
        QR Code Visible
    }

    QuizPublished --> EmptyState : clearAll()

    note right of QuestionsAdded
        Computed Properties:
        - canPublish()
        - questionCount()
        - disableAdd()
    end note
```
