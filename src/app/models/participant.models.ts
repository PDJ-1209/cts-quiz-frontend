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
  joinedAt: string;
}
