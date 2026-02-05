export interface CalendarDate {
  date: Date;
  quizCount: number;
  currentHostQuizCount: number;
  otherHostsQuizCount: number;
  currentHostId?: string;
}

export interface QuizCalendar {
  quizId: number;
  quizTitle?: string;
  publishedDate?: Date;
  publishedBy?: string;
  hostName?: string;
  isCurrentHost: boolean;
}

export interface CalendarResponse {
  dates: CalendarDate[];
  quizzes: QuizCalendar[];
}
