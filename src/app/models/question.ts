export interface Question {
  questionId?: number;
  quizId?: number;
  templateId?: number;
  questionText: string;
  questionType?: string;
  category?: string;
  difficultyLevel?: string;
  tags?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status?: string;
  options?: Option[];
}

export interface Option {
  optionId?: number;
  questionId?: number;
  optionText: string;
  isCorrect?: boolean;
}
