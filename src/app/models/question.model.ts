export interface Question {
  id?: string;
  questionId?: number;
  text?: string;
  questionText?: string;
  options?: QuestionOption[];
  answer?: string; // correct option text
  isCorrect?: boolean;
  category?: string;
  difficulty?: string;
  difficultyLevel?: string;
  tags?: string;
}

export interface QuestionOption {
  optionId?: number;
  id?: number;
  text?: string;
  optionText?: string;
  isCorrect?: boolean;
  questionId?: number;
}

