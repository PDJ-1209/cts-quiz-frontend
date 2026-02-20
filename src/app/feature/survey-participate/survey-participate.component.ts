import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import * as signalR from '@microsoft/signalr';
import { SurveyService } from '../../services/survey.service';
import { SurveyOverview, SurveyQuestionOverview, SurveyResponse } from '../../models/isurvey';
import { environment } from '../../environments/environment';

interface MultiSelectQuestion {
  selectedOptions: number[];
  rankings: { [optionId: number]: number };
}

@Component({
  selector: 'app-survey-participate',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './survey-participate.component.html',
  styleUrls: ['./survey-participate.component.css']
})
export class SurveyParticipateComponent implements OnInit, OnDestroy {
  survey: SurveyOverview | null = null;
  surveyForm!: FormGroup;
  loading = true;
  submitting = false;
  participantId: number = 0;
  sessionId: number = 0;
  sessionCode: string = '';
  hasSubmitted = false;
  surveyEnded = false;
  
  // Multi-select and ranking state
  multiSelectState: { [questionId: number]: MultiSelectQuestion } = {};
  
  // One-question-at-a-time state
  currentQuestionIndex = 0;
  questionTimer = 10; // 30 seconds per question
  timerInterval?: any;
  answeredQuestions: Set<number> = new Set();
  questionStartTime?: Date;
  canNavigate = false; // Controls if user can go to next question
  autoSubmitting = false;
  
  // SignalR
  private hubConnection?: signalR.HubConnection;
  private hasNavigatedAway = false;
  
  private fb = inject(FormBuilder);
  private surveyService = inject(SurveyService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  // Expose localStorage to template
  localStorage = localStorage;

  ngOnInit(): void {
    // Try getting from query params first (for direct navigation)
    this.route.queryParams.subscribe(params => {
      if (params['sessionCode']) {
        this.sessionCode = params['sessionCode'];
        localStorage.setItem('sessionCode', params['sessionCode']);
      }
      if (params['participantId']) {
        this.participantId = +params['participantId'];
        localStorage.setItem('participantId', params['participantId']);
      }
      if (params['surveyId']) {
        localStorage.setItem('surveyId', params['surveyId']);
      }
    });

    // Get session ID from route params or query params or localStorage
    this.route.params.subscribe(params => {
      const sessionId = params['sessionId'];
      if (sessionId) {
        this.sessionId = parseInt(sessionId);
        this.loadSurvey();
      } else {
        // Try query params
        this.route.queryParams.subscribe(queryParams => {
          if (queryParams['sessionId']) {
            this.sessionId = parseInt(queryParams['sessionId']);
            this.loadSurvey();
          } else {
            // Try localStorage
            const storedSessionId = localStorage.getItem('sessionId') || localStorage.getItem('surveySessionId');
            if (storedSessionId) {
              this.sessionId = parseInt(storedSessionId);
              this.loadSurvey();
            } else {
              this.snackBar.open('No survey session found', 'Close', { duration: 3000 });
              this.router.navigate(['/']);
            }
          }
        });
      }
    });

    // Get participant ID and session code from localStorage if not already set
    if (!this.participantId) {
      const participantIdStr = localStorage.getItem('participantId');
      if (participantIdStr) {
        this.participantId = parseInt(participantIdStr);
      }
    }
    
    if (!this.sessionCode) {
      this.sessionCode = localStorage.getItem('sessionCode') || '';
    }
    
    // Initialize SignalR
    this.initializeSignalR();
    
    // Prevent back navigation
    history.pushState(null, '', location.href);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    this.cleanup();
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    if (!this.hasSubmitted && !this.surveyEnded) {
      const confirmed = confirm('Are you sure you want to leave? Your responses will not be submitted.');
      if (!confirmed) {
        history.pushState(null, '', location.href);
        return;
      }
    }
    this.cleanup();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden && this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      // Refresh session sync when page becomes visible
      this.refreshSessionSync();
    }
  }

  private async initializeSignalR(): Promise<void> {
    try {
      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(environment.signalRUrl, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect()
        .build();

      // Listen for survey republish event
      this.hubConnection.on('SurveyRepublished', (data: any) => {
        console.log('Survey republished event received:', data);
        if (data.sessionCode === this.sessionCode || data.SessionCode === this.sessionCode) {
          this.snackBar.open('Survey has been restarted!', 'Close', { duration: 2000 });
          this.hasSubmitted = false;
          this.surveyEnded = false;
          this.loadSurvey();
        }
      });

      // Listen for survey ended event
      this.hubConnection.on('SurveyEnded', (data: any) => {
        console.log('Survey ended event received:', data);
        if (data.sessionCode === this.sessionCode || data.SessionCode === this.sessionCode) {
          this.handleSurveyEnd();
        }
      });

      await this.hubConnection.start();
      console.log('SignalR connected for survey participation');

      // Join the session
      if (this.sessionCode) {
        await this.hubConnection.invoke('JoinSession', this.sessionCode);
        console.log(`Joined survey session: ${this.sessionCode}`);
      }

      // Request initial session sync
      await this.refreshSessionSync();
    } catch (error) {
      console.error('SignalR connection error:', error);
    }
  }

  private async refreshSessionSync(): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        if (this.sessionCode) {
          await this.hubConnection.invoke('RequestSessionSync', this.sessionCode);
        }
      } catch (error) {
        console.error('Error requesting session sync:', error);
      }
    }
  }

  private handleSurveyEnd(): void {
    this.surveyEnded = true;
    this.snackBar.open('Survey has ended by host', 'Close', { duration: 3000 });
    
    setTimeout(() => {
      this.navigateToResults();
    }, 2000);
  }

  private async navigateToResults(): Promise<void> {
    this.hasNavigatedAway = true;
    
    // Leave session before navigating
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        if (this.sessionCode) {
          await this.hubConnection.invoke('LeaveSession', this.sessionCode);
        }
      } catch (error) {
        console.error('Error leaving session:', error);
      }
    }

    this.cleanup();
    this.router.navigate(['/survey/thank-you']);
  }

  private cleanup(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }

  loadSurvey(): void {
    this.loading = true;
    this.surveyService.getParticipantSurveyBySession(this.sessionId).subscribe({
      next: (survey) => {
        console.log('=== SURVEY LOADED ===');
        console.log('Full survey data:', survey);
        console.log('Questions:', survey.questions);
        
        // Debug ranking questions specifically
        const rankingQuestions = survey.questions?.filter(q => q.questionType === 'ranking');
        console.log('Ranking questions found:', rankingQuestions?.length);
        rankingQuestions?.forEach((q, index) => {
          console.log(`Ranking Question ${index + 1}:`, {
            questionId: q.surveyQuestionId,
            questionText: q.questionText,
            questionType: q.questionType,
            optionsCount: q.options?.length,
            options: q.options
          });
        });
        
        this.survey = survey;
        this.initializeForm();
        this.loading = false;
        // Start timer for first question
        this.startQuestionTimer();
      },
      error: (error) => {
        console.error('Error loading survey:', error);
        this.snackBar.open('Failed to load survey', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  initializeForm(): void {
    if (!this.survey) return;

    const formGroups: { [key: string]: any } = {};

    this.survey.questions?.forEach((question) => {
      const questionId = question.surveyQuestionId;

      // Initialize multi-select state
      if (this.isMultiSelectQuestion(question)) {
        this.multiSelectState[questionId] = {
          selectedOptions: [],
          rankings: {}
        };
      }

      // Create form controls based on question type
      if (question.questionType === 'text' || question.questionType === 'short_text') {
        formGroups[`q_${questionId}`] = [
          '', 
          question.isRequired ? Validators.required : []
        ];
      } else if (question.questionType === 'rating' || question.questionType === 'scale') {
        formGroups[`q_${questionId}`] = [
          null, 
          question.isRequired ? Validators.required : []
        ];
      } else if (question.questionType === 'single_choice') {
        formGroups[`q_${questionId}`] = [
          null, 
          question.isRequired ? Validators.required : []
        ];
      } else if (this.isMultiSelectQuestion(question)) {
        // Multi-select and ranking use custom state management
        formGroups[`q_${questionId}`] = [null];
      }
    });

    this.surveyForm = this.fb.group(formGroups);
  }

  isMultiSelectQuestion(question: SurveyQuestionOverview): boolean {
    return question.questionType === 'multiple_choice' || 
           question.questionType === 'ranking' ||
           question.questionType === 'multi_select';
  }

  isRankingQuestion(question: SurveyQuestionOverview): boolean {
    return question.questionType === 'ranking';
  }

  toggleMultiSelectOption(questionId: number, optionId: number): void {
    const state = this.multiSelectState[questionId];
    if (!state) return;

    const question = this.survey?.questions?.find(q => q.surveyQuestionId === questionId);
    const isRanking = question && this.isRankingQuestion(question);

    const index = state.selectedOptions.indexOf(optionId);
    if (index > -1) {
      // Remove option
      state.selectedOptions.splice(index, 1);
      delete state.rankings[optionId];
      
      // Re-number remaining rankings in ascending order
      if (isRanking) {
        this.reorderRankingsAscending(questionId);
      } else {
        this.reorderRankings(questionId);
      }
    } else {
      // Add option
      state.selectedOptions.push(optionId);
      
      // For ranking questions, automatically assign the next rank in ascending order
      if (isRanking) {
        // First selection gets rank 1, second gets rank 2, etc.
        state.rankings[optionId] = state.selectedOptions.length;
      }
    }
  }

  isOptionSelected(questionId: number, optionId: number): boolean {
    return this.multiSelectState[questionId]?.selectedOptions.includes(optionId) || false;
  }

  setRanking(questionId: number, optionId: number, rank: number): void {
    const state = this.multiSelectState[questionId];
    if (!state) return;

    // Find if another option has this rank
    const existingOptionId = Object.keys(state.rankings).find(
      key => state.rankings[parseInt(key)] === rank && parseInt(key) !== optionId
    );

    if (existingOptionId) {
      // Swap ranks
      const oldRank = state.rankings[optionId];
      state.rankings[optionId] = rank;
      state.rankings[parseInt(existingOptionId)] = oldRank;
    } else {
      state.rankings[optionId] = rank;
    }
  }

  getRanking(questionId: number, optionId: number): number | undefined {
    return this.multiSelectState[questionId]?.rankings[optionId];
  }

  getRankOptions(questionId: number): number[] {
    const selectedCount = this.multiSelectState[questionId]?.selectedOptions.length || 0;
    return Array.from({ length: selectedCount }, (_, i) => i + 1);
  }

  private reorderRankings(questionId: number): void {
    const state = this.multiSelectState[questionId];
    if (!state) return;

    // Get all rankings sorted by value
    const rankedOptions = Object.entries(state.rankings)
      .sort(([, rankA], [, rankB]) => rankA - rankB);

    // Reassign sequential rankings
    rankedOptions.forEach(([optionId, _], index) => {
      state.rankings[parseInt(optionId)] = index + 1;
    });
  }

  private reorderRankingsAscending(questionId: number): void {
    const state = this.multiSelectState[questionId];
    if (!state) return;

    // Reassign ranks based on selection order (1, 2, 3...)
    state.selectedOptions.forEach((optionId, index) => {
      state.rankings[optionId] = index + 1;
    });
  }

  validateForm(): boolean {
    if (!this.survey) return false;

    // Validate standard form fields
    if (this.surveyForm.invalid) {
      this.snackBar.open('Please answer all required questions', 'Close', { duration: 3000 });
      return false;
    }

    // Validate multi-select and ranking questions
    for (const question of this.survey.questions || []) {
      if (question.isRequired && this.isMultiSelectQuestion(question)) {
        const state = this.multiSelectState[question.surveyQuestionId];
        if (!state || state.selectedOptions.length === 0) {
          this.snackBar.open(`Please select at least one option for: ${question.questionText}`, 'Close', { 
            duration: 3000 
          });
          return false;
        }

        // For ranking questions, ensure all selected options have ranks
        if (this.isRankingQuestion(question)) {
          const hasAllRanks = state.selectedOptions.every(
            optionId => state.rankings[optionId] !== undefined
          );
          if (!hasAllRanks) {
            this.snackBar.open(`Please rank all selected options for: ${question.questionText}`, 'Close', { 
              duration: 3000 
            });
            return false;
          }
        }
      }
    }

    return true;
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.hasSubmitted || this.surveyEnded) {
      this.snackBar.open('Survey already submitted or ended', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;

    const responses: any[] = [];

    this.survey?.questions?.forEach((question) => {
      const questionId = question.surveyQuestionId;
      const formValue = this.surveyForm.get(`q_${questionId}`)?.value;

      if (question.questionType === 'text' || question.questionType === 'short_text') {
        if (formValue) {
          responses.push({
            SurveyQuestionId: questionId,
            ResponseText: formValue
          });
        }
      } else if (question.questionType === 'rating' || question.questionType === 'scale') {
        if (formValue !== null && formValue !== undefined) {
          responses.push({
            SurveyQuestionId: questionId,
            ResponseNumber: formValue
          });
        }
      } else if (question.questionType === 'single_choice') {
        if (formValue) {
          responses.push({
            SurveyQuestionId: questionId,
            SelectedOptionId: formValue
          });
        }
      } else if (this.isMultiSelectQuestion(question)) {
        const state = this.multiSelectState[questionId];
        if (state && state.selectedOptions.length > 0) {
          responses.push({
            SurveyQuestionId: questionId,
            SelectedOptionIds: state.selectedOptions,
            OptionRanks: this.isRankingQuestion(question) ? state.rankings : undefined
          });
        }
      }
    });

    const payload = {
      SessionId: this.sessionId,
      ParticipantId: this.participantId,
      Responses: responses
    };

    this.surveyService.submitSurveyResponses(payload).subscribe({
      next: () => {
        this.hasSubmitted = true;
        this.submitting = false;
        // Don't navigate away - show thank you card instead
        this.snackBar.open('✅ Survey completed successfully!', 'Close', { duration: 2000 });
      },
      error: (error) => {
        console.error('Error submitting survey:', error);
        this.snackBar.open(
          error.error?.message || 'Failed to submit survey. Please try again.', 
          'Close', 
          { duration: 3000 }
        );
        this.submitting = false;
      }
    });
  }

  getScaleArray(min: number, max: number): number[] {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  // ========== NEW: Timer and Navigation Methods ==========

  startQuestionTimer(): void {
    this.stopTimer(); // Clear any existing timer
    this.questionTimer = 30;
    this.canNavigate = false;
    this.questionStartTime = new Date();

    this.timerInterval = setInterval(() => {
      this.questionTimer--;

      if (this.questionTimer <= 0) {
        this.stopTimer();
        this.canNavigate = true;
        this.autoSubmitCurrentQuestion();
      }
    }, 1000);
  }

  stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
  }

  get currentQuestion(): SurveyQuestionOverview | null {
    if (!this.survey?.questions || this.currentQuestionIndex >= this.survey.questions.length) {
      return null;
    }
    const question = this.survey.questions[this.currentQuestionIndex];
    
    // Debug logging for ranking questions
    if (question.questionType === 'ranking') {
      console.log('=== CURRENT RANKING QUESTION ===');
      console.log('Question:', question);
      console.log('Options available:', question.options?.length);
      console.log('Options data:', question.options);
    }
    
    return question;
  }

  get totalQuestions(): number {
    return this.survey?.questions?.length || 0;
  }

  get questionNumbers(): number[] {
    return Array.from({ length: this.totalQuestions }, (_, i) => i + 1);
  }

  isQuestionCompleted(index: number): boolean {
    return this.answeredQuestions.has(index);
  }

  isCurrentQuestion(index: number): boolean {
    return index === this.currentQuestionIndex;
  }

  submitCurrentAnswer(): void {
    if (!this.canNavigate) {
      this.snackBar.open('Please wait for the timer to complete', 'Close', { duration: 2000 });
      return;
    }

    this.moveToNextQuestion();
  }

  autoSubmitCurrentQuestion(): void {
    this.autoSubmitting = true;
    
    // Mark current question as answered
    this.answeredQuestions.add(this.currentQuestionIndex);

    setTimeout(() => {
      this.autoSubmitting = false;
      this.moveToNextQuestion();
    }, 500);
  }

  moveToNextQuestion(): void {
    // Mark current question as completed
    this.answeredQuestions.add(this.currentQuestionIndex);

    if (this.currentQuestionIndex < this.totalQuestions - 1) {
      // Move to next question
      this.currentQuestionIndex++;
      this.startQuestionTimer();
    } else {
      // All questions completed, submit survey
      this.submitAllResponses();
    }
  }

  submitAllResponses(): void {
    if (this.hasSubmitted || this.surveyEnded) {
      return;
    }

    this.submitting = true;
    this.stopTimer();

    const responses: any[] = [];

    this.survey?.questions?.forEach((question) => {
      const questionId = question.surveyQuestionId;
      const formValue = this.surveyForm.get(`q_${questionId}`)?.value;

      if (question.questionType === 'text' || question.questionType === 'short_text') {
        if (formValue) {
          responses.push({
            SurveyQuestionId: questionId,
            ResponseText: formValue
          });
        }
      } else if (question.questionType === 'rating' || question.questionType === 'scale') {
        if (formValue !== null && formValue !== undefined) {
          responses.push({
            SurveyQuestionId: questionId,
            ResponseNumber: formValue
          });
        }
      } else if (question.questionType === 'single_choice') {
        if (formValue) {
          responses.push({
            SurveyQuestionId: questionId,
            SelectedOptionId: formValue
          });
        }
      } else if (this.isMultiSelectQuestion(question)) {
        const state = this.multiSelectState[questionId];
        if (state && state.selectedOptions.length > 0) {
          responses.push({
            SurveyQuestionId: questionId,
            SelectedOptionIds: state.selectedOptions,
            OptionRanks: this.isRankingQuestion(question) ? state.rankings : undefined
          });
        }
      }
    });

    const payload = {
      SessionId: this.sessionId,
      ParticipantId: this.participantId,
      Responses: responses
    };

    this.surveyService.submitSurveyResponses(payload).subscribe({
      next: () => {
        this.hasSubmitted = true;
        this.submitting = false;
        this.snackBar.open('Survey completed successfully!', 'Close', { duration: 3000 });
        
        setTimeout(() => {
          this.navigateToResults();
        }, 1500);
      },
      error: (error) => {
        console.error('Error submitting survey:', error);
        this.snackBar.open(
          error.error?.message || 'Failed to submit survey. Please try again.', 
          'Close', 
          { duration: 3000 }
        );
        this.submitting = false;
      }
    });
  }

  getTimerDisplay(): string {
    const minutes = Math.floor(this.questionTimer / 60);
    const seconds = this.questionTimer % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getTimerPercentage(): number {
    return (this.questionTimer / 30) * 100;
  }
}
