export interface ValidateSessionResponse {
  isValid: boolean;
  message: string;
  sessionId?: number;
  quizId?: number;
  quizTitle?: string;
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
  questions: QuestionDetail[];
  startedAt?: string;
}

export interface SubmitAnswerRequest {
  participantId: number;
  questionId: number;
  selectedOptionId: number;
  timeSpentSeconds?: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctOptionId: number;
  explanation?: string;
}
