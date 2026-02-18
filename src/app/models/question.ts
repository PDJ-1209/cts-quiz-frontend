export interface Question {
  questionId?: number;
  templateId: number;
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
}
