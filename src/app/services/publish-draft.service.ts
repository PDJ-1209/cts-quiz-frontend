import { Injectable } from '@angular/core';

export interface SurveyDraftQuestion {
  questionText: string;
  questionType: string;
  questionOrder: number;
  isRequired: boolean;
  scaleMin?: number;
  scaleMax?: number;
  options?: { optionText: string; displayOrder: number }[];
}

export interface SurveyDraft {
  title: string;
  description?: string;
  isAnonymous: boolean;
  questions: SurveyDraftQuestion[];
}

export interface PollDraftItem {
  pollQuestion: string;
  pollAnonymous: boolean;
  pollStatus?: string;
  selectionType?: string;
  options: { optionLabel: string; optionOrder?: number }[];
}

export interface PollDraft {
  title: string;
  items: PollDraftItem[];
}

@Injectable({
  providedIn: 'root'
})
export class PublishDraftService {
  private surveyDraft: SurveyDraft | null = null;
  private pollDraft: PollDraft | null = null;

  setSurveyDraft(draft: SurveyDraft): void {
    this.surveyDraft = draft;
  }

  consumeSurveyDraft(): SurveyDraft | null {
    const draft = this.surveyDraft;
    this.surveyDraft = null;
    return draft;
  }

  setPollDraft(draft: PollDraft): void {
    this.pollDraft = draft;
  }

  consumePollDraft(): PollDraft | null {
    const draft = this.pollDraft;
    this.pollDraft = null;
    return draft;
  }
}
