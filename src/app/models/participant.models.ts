export interface ValidateSessionResponse {
  isValid: boolean;
  message: string;
  sessionId?: number;
  quizId?: number;
<<<<<<< HEAD
  surveyId?: number;
  pollId?: number;
  quizTitle?: string;
  sessionType?: string; // 'quiz', 'survey', or 'poll'
=======
  pollId?: number;
  surveyId?: number;
  quizTitle?: string;
  sessionType?: string; // 'Quiz', 'Poll', or 'Survey'
>>>>>>> 2e73df1791eb660398b638e6660e33385d16d837
  startedAt?: string;
  endedAt?: string;
  status?: string;
}

export interface JoinSessionRequest {
  sessionCode: string;
  nickname: string;
  employeeId?: string;
}

export interface ParticipantResponse {
  participantId: number;
  sessionId: number;
  nickname: string;
  employeeId?: string;
  totalScore?: number;
  joinedAt: string; // Will be converted from backend DateTime
}

export interface QuestionDetail {
  questionId: number;
  questionText: string;
  questionType: string;
  timerSeconds: number;
  options: OptionDetail[];
}

export interface OptionDetail {
  optionId: number;
  optionText: string;
}

export interface SessionQuestionsResponse {
  sessionId: number;
  quizId: number;
  quizTitle: string;
  totalQuestions: number;
  startedAt?: string;
  serverTime?: string;
  currentQuestionId?: number;
  currentQuestionStartTime?: string;
  timerDurationSeconds?: number;
  questions: QuestionDetail[];
}

export interface SubmitAnswerRequest {
  participantId: number;
  questionId: number;
  selectedOptionId: number;
  timeSpentSeconds?: number;
  textResponse?: string; // For survey text questions
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctOptionId: number;
  explanation?: string;
}
