import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { SurveyService } from '../../services/survey.service';
import { 
  SurveyOverview, 
  SurveyQuestionOverview, 
  SurveyQuestionOptionOverview,
  SurveySubmissionResponse
} from '../../models/isurvey';

interface QuestionResponse {
  surveyQuestionId: number;
  questionType: string;
  // Single select
  selectedOptionId?: number;
  // Multi-select
  selectedOptionIds?: number[];
  // Ranking
  rankedOptions?: { optionId: number; rank: number }[];
  // Text/Number
  responseText?: string;
  responseNumber?: number;
}

@Component({
  selector: 'app-take-survey',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatRadioModule,
    DragDropModule
  ],
  templateUrl: './take-survey.component.html',
  styleUrls: ['./take-survey.component.css']
})
export class TakeSurveyComponent implements OnInit {
  private surveyService = inject(SurveyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  survey: SurveyOverview | null = null;
  sessionId: number = 0;
  participantId: number = 0;
  loading = true;
  submitting = false;

  // Store responses for each question
  responses: Map<number, QuestionResponse> = new Map();

  // For ranking questions - store draggable items
  rankingOptions: Map<number, SurveyQuestionOptionOverview[]> = new Map();

  ngOnInit(): void {
    // Get session and participant IDs from route or localStorage
    this.route.queryParams.subscribe(params => {
      this.sessionId = parseInt(params['sessionId'] || localStorage.getItem('sessionId') || '0');
      this.participantId = parseInt(params['participantId'] || localStorage.getItem('participantId') || '0');

      if (!this.sessionId || !this.participantId) {
        this.snackBar.open('⚠️ Invalid session. Please join a survey first.', 'Close', { duration: 5000 });
        this.router.navigate(['/']);
        return;
      }

      this.loadSurvey();
    });
  }

  async loadSurvey(): Promise<void> {
    try {
      this.loading = true;
      this.survey = await this.surveyService.getParticipantSurveyBySession(this.sessionId).toPromise() || null;

      if (!this.survey || !this.survey.questions) {
        throw new Error('Survey not found');
      }

      // Initialize responses map
      this.survey.questions.forEach(question => {
        const response: QuestionResponse = {
          surveyQuestionId: question.surveyQuestionId,
          questionType: question.questionType
        };

        // Initialize multi-select with empty array
        if (this.isMultiSelect(question.questionType)) {
          response.selectedOptionIds = [];
        }

        // Initialize ranking with options
        if (this.isRanking(question.questionType)) {
          response.rankedOptions = [];
          if (question.options) {
            this.rankingOptions.set(question.surveyQuestionId, [...question.options]);
          }
        }

        this.responses.set(question.surveyQuestionId, response);
      });

      console.log('[TakeSurvey] Loaded survey:', this.survey);
    } catch (error: any) {
      console.error('[TakeSurvey] Error loading survey:', error);
      this.snackBar.open(`❌ Failed to load survey: ${error.message}`, 'Close', { duration: 5000 });
      this.router.navigate(['/']);
    } finally {
      this.loading = false;
    }
  }

  // Question type helpers
  isSingleSelect(type: string): boolean {
    return ['single-select', 'multiple-choice', 'dropdown', 'radio'].includes(type.toLowerCase());
  }

  isMultiSelect(type: string): boolean {
    return ['multi-select', 'checkbox', 'multiple-choice-multiple'].includes(type.toLowerCase());
  }

  isRanking(type: string): boolean {
    return ['ranking', 'rank-order'].includes(type.toLowerCase());
  }

  isText(type: string): boolean {
    return ['text', 'textarea', 'short-answer', 'long-answer'].includes(type.toLowerCase());
  }

  isNumeric(type: string): boolean {
    return ['number', 'rating', 'scale'].includes(type.toLowerCase());
  }

  // Single select handler
  onSingleSelectChange(questionId: number, optionId: number): void {
    const response = this.responses.get(questionId);
    if (response) {
      response.selectedOptionId = optionId;
    }
  }

  // Multi-select handler
  onMultiSelectChange(questionId: number, optionId: number, checked: boolean): void {
    const response = this.responses.get(questionId);
    if (response && response.selectedOptionIds) {
      if (checked) {
        if (!response.selectedOptionIds.includes(optionId)) {
          response.selectedOptionIds.push(optionId);
        }
      } else {
        response.selectedOptionIds = response.selectedOptionIds.filter(id => id !== optionId);
      }
    }
  }

  // Check if option is selected in multi-select
  isMultiSelectChecked(questionId: number, optionId: number): boolean {
    const response = this.responses.get(questionId);
    return response?.selectedOptionIds?.includes(optionId) || false;
  }

  // Ranking drag & drop handler
  onRankingDrop(event: CdkDragDrop<SurveyQuestionOptionOverview[]>, questionId: number): void {
    const options = this.rankingOptions.get(questionId);
    if (options) {
      moveItemInArray(options, event.previousIndex, event.currentIndex);
      
      // Update response with new ranking
      const response = this.responses.get(questionId);
      if (response) {
        response.rankedOptions = options.map((opt, index) => ({
          optionId: opt.optionId,
          rank: index + 1
        }));
      }
    }
  }

  // Get ranking options for display
  getRankingOptions(questionId: number): SurveyQuestionOptionOverview[] {
    return this.rankingOptions.get(questionId) || [];
  }

  // Validation
  isQuestionAnswered(question: SurveyQuestionOverview): boolean {
    const response = this.responses.get(question.surveyQuestionId);
    if (!response) return false;

    if (this.isSingleSelect(question.questionType)) {
      return response.selectedOptionId !== undefined;
    }

    if (this.isMultiSelect(question.questionType)) {
      return (response.selectedOptionIds?.length || 0) > 0;
    }

    if (this.isRanking(question.questionType)) {
      return (response.rankedOptions?.length || 0) === (question.options?.length || 0);
    }

    if (this.isText(question.questionType)) {
      return !!response.responseText?.trim();
    }

    if (this.isNumeric(question.questionType)) {
      return response.responseNumber !== undefined && response.responseNumber !== null;
    }

    return false;
  }

  canSubmit(): boolean {
    if (!this.survey?.questions) return false;

    return this.survey.questions
      .filter(q => q.isRequired)
      .every(q => this.isQuestionAnswered(q));
  }

  async submitSurvey(): Promise<void> {
    if (!this.canSubmit()) {
      this.snackBar.open('⚠️ Please answer all required questions', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.submitting = true;

      // Build submission payload
      const payload: any = {
        sessionId: this.sessionId,
        participantId: this.participantId,
        responses: []
      };

      for (const [questionId, response] of this.responses.entries()) {
        // Handle multi-select questions
        if (response.selectedOptionIds && response.selectedOptionIds.length > 0) {
          payload.responses.push({
            surveyQuestionId: questionId,
            selectedOptionIds: response.selectedOptionIds
          });
        }
        // Handle ranking questions
        else if (response.rankedOptions && response.rankedOptions.length > 0) {
          // Create multiple entries for ranking
          response.rankedOptions.forEach(ranked => {
            payload.responses.push({
              surveyQuestionId: questionId,
              selectedOptionId: ranked.optionId,
              optionRank: ranked.rank
            });
          });
        }
        // Handle single select
        else if (response.selectedOptionId) {
          payload.responses.push({
            surveyQuestionId: questionId,
            selectedOptionId: response.selectedOptionId
          });
        }
        // Handle text
        else if (response.responseText) {
          payload.responses.push({
            surveyQuestionId: questionId,
            responseText: response.responseText
          });
        }
        // Handle numeric
        else if (response.responseNumber !== undefined) {
          payload.responses.push({
            surveyQuestionId: questionId,
            responseNumber: response.responseNumber
          });
        }
      }

      console.log('[TakeSurvey] Submitting payload:', payload);

      const result: SurveySubmissionResponse = await this.surveyService.submitSurveyResponses(payload).toPromise() || {} as SurveySubmissionResponse;

      this.snackBar.open('✅ Survey submitted successfully!', 'Close', { duration: 3000 });
      
      // Navigate to success page or back
      setTimeout(() => {
        this.router.navigate(['/survey-complete']);
      }, 1500);

    } catch (error: any) {
      console.error('[TakeSurvey] Submission error:', error);
      this.snackBar.open(`❌ Failed to submit survey: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.submitting = false;
    }
  }
}
