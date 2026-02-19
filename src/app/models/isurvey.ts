// 1. Core Data Models (Used for GET/Display)
export interface Survey {
  survey_id?: number;
  session_id?: number;
  title: string;
  description?: string;
  is_anonymous: boolean;
  status: string;
  questions?: SurveyQuestion[];
  questionCount?: number;
}

export interface SurveyQuestion {
  survey_question_id?: number;
  survey_id?: number;
  question_text: string;
  question_type: string;
  question_order: number;
  is_required: boolean;
  options?: SurveyQuestionOption[];
  scale_min?: number;
  scale_max?: number;
  scale_labels?: string[];
}

export interface SurveyQuestionOption {
  option_id?: number;
  survey_question_id?: number;
  option_text: string;
  display_order: number;
  score_value?: number;
}

// 2. Creation Models (POST /api/host/survey/create)
export interface CreateSurveyRequest {
  session_id?: number;
  title: string;
  description?: string;
  is_anonymous: boolean;
  questions: CreateQuestionRequest[];
}

export interface CreateQuestionRequest {
  question_text: string;
  question_type: string;
  is_required: boolean;
  question_order: number;
  options?: CreateQuestionOptionRequest[];
  scale_min?: number;
  scale_max?: number;
  scale_labels?: string[];
}

export interface CreateQuestionOptionRequest {
  option_text: string;
  display_order: number;
}

export interface CreateSurveyResponse {
  surveyId: number;
  message: string;
  status: string;
}

// v2 API payloads (camelCase)
export interface CreateSurveyApiRequest {
  sessionId?: number | null;
  title: string;
  description?: string;
  isAnonymous: boolean;
  status?: string;
  questions: CreateSurveyQuestionApiRequest[];
}

export interface CreateSurveyQuestionApiRequest {
  sessionId?: number | null;
  questionText: string;
  questionType: string;
  questionOrder: number;
  isRequired: boolean;
  scaleMin?: number;
  scaleMax?: number;
  options?: CreateSurveyQuestionOptionApiRequest[];
}

export interface CreateSurveyQuestionOptionApiRequest {
  optionText: string;
  displayOrder: number;
  scoreValue?: number;
}

// v2 API responses (camelCase)
export interface SurveyOverview {
  surveyId: number;
  sessionId?: number | null;
  sessionCode?: string;
  title: string;
  description?: string | null;
  isAnonymous: boolean;
  status: string;
  startTime?: string;
  endTime?: string;
  questions?: SurveyQuestionOverview[];
}

export interface SurveyQuestionOverview {
  surveyQuestionId: number;
  sessionId?: number | null;
  questionText: string;
  questionType: string;
  questionOrder: number;
  isRequired: boolean;
  scaleMin?: number | null;
  scaleMax?: number | null;
  options?: SurveyQuestionOptionOverview[];
}

export interface SurveyQuestionOptionOverview {
  optionId: number;
  optionText: string;
  displayOrder: number;
  scoreValue?: number | null;
}

// 3. Publishing & Management
export interface PublishSurveyRequest {
  surveyId: number;
  employeeId: number;
}

export interface PublishSurveyResponse {
  success: boolean;
  message: string;
  data: {
    sessionId: number;
    joinCode: string;
    surveyId: number;
    surveyTitle: string;
    publishedAt: string;
  };
}

export interface SurveyListResponse {
  count: number;
  surveys: Survey[];
}

// 4. Submission & Participation
export interface SurveySubmission {
  participantId: number;
  surveyId: number;
  sessionId: number;
  responses: SurveyResponse[];
}

export interface SurveyResponse {
  survey_question_id: number;
  response_text?: string;
  response_number?: number;
  selected_option_id?: number;
  // NEW: For multi-select questions
  selected_option_ids?: number[];
  // NEW: For ranking questions
  option_rank?: number;
}

export interface SurveySubmissionResponse {
  success: boolean;
  message: string;
  responseCount: number;
  submittedAt: string;
}

// 5. Analytics & Results
export interface SurveyResult {
  surveyId: number;
  title: string;
  totalResponses: number;
  questionResults: QuestionResult[];
}

export interface QuestionResult {
  questionId: number;
  questionText: string;
  questionType: string;
  responseCount: number;
  options?: OptionResult[];
  textResponses?: string[];
  numericStats?: NumericStats;
  rankingStats?: RankingStats[];
}

export interface OptionResult {
  optionId: number;
  optionText: string;
  count: number;
  percentage: number;
}

export interface NumericStats {
  average: number;
  median: number;
  min: number;
  max: number;
  allValues: number[];
}

export interface RankingStats {
  optionId: number;
  optionText: string;
  averageRank: number;
  rankDistribution: { [rank: number]: number };
}

// Analytics DTOs (matching backend)
export interface SurveyAnalyticsDto {
  surveyId: number;
  title: string;
  totalResponses: number;
  questions: QuestionAnalyticsDto[];
}

export interface QuestionAnalyticsDto {
  surveyQuestionId: number;
  questionText: string;
  questionType: string;
  responseCount: number;
  optionStats?: OptionAnalyticsDto[];
  textResponses?: string[];
  numericStats?: NumericAnalyticsDto;
  rankingStats?: RankingAnalyticsDto[];
}

export interface OptionAnalyticsDto {
  optionId: number;
  optionText: string;
  count: number;
  percentage: number;
}

export interface NumericAnalyticsDto {
  average: number;
  median: number;
  min: number;
  max: number;
  allValues: number[];
}

export interface RankingAnalyticsDto {
  optionId: number;
  optionText: string;
  averageRank: number;
  rankDistribution: { [rank: number]: number };
}

// 6. Miscellaneous
export interface Upvote {
  upvote_id?: number;
  survey_question_id: number;
  participant_id: number;
}

export interface ActiveSurveyResponse {
  survey_id: number;
  title: string;
  is_anonymous: boolean;
  questions: SurveyQuestion[];
}

// 7. Session Models (Related to Surveys)
export interface CreateSessionRequest {
    title: string;
    employeeId: number;
    startAt: string; 
    endAt: string;   
    status: string;
}