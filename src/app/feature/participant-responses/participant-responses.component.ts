import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { PollService } from '../../services/poll.service';
import { SurveyService } from '../../services/survey.service';
import { SignalrService } from '../../services/signalr.service';
import { PollResponse } from '../../models/ipoll';
import { SurveyResponse } from '../../models/isurvey';
import { CountdownTimerComponent } from '../../shared/countdown-timer/countdown-timer.component';

interface DisplayResponse {
  questionText: string;
  questionType: string;
  answers: string[];
  rawResponse?: any;
}

@Component({
  selector: 'app-participant-responses',
  standalone: true,
  imports: [CommonModule, RouterModule, CountdownTimerComponent],
  templateUrl: './participant-responses.component.html',
  styleUrls: ['./participant-responses.component.css']
})
export class ParticipantResponsesComponent implements OnInit, OnDestroy {
  // Route parameters
  participantId: number = 0;
  surveyId?: number;
  pollId?: number;
  sessionCode?: string;

  // Data
  pollResponses: PollResponse[] = [];
  surveyResponses: SurveyResponse[] = [];
  displayPollResponses: DisplayResponse[] = [];
  displaySurveyResponses: DisplayResponse[] = [];

  // UI state
  activeTab: 'poll' | 'survey' = 'poll';
  loading = false;
  error: string | null = null;
  showCountdown = false;
  countdownDuration = 45;
  currentQuestionIndex = 0;

  // SignalR state
  isConnected = false;
  reconnecting = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pollService: PollService,
    private surveyService: SurveyService,
    private signalrService: SignalrService
  ) {}

  ngOnInit(): void {
    // Get route parameters
    this.route.queryParams.subscribe(params => {
      this.participantId = +params['participantId'] || 0;
      this.surveyId = params['surveyId'] ? +params['surveyId'] : undefined;
      this.pollId = params['pollId'] ? +params['pollId'] : undefined;
      this.sessionCode = params['sessionCode'] || undefined;

      if (!this.participantId) {
        this.error = 'Participant ID is required';
        return;
      }

      // Set initial tab based on parameters
      if (this.surveyId) {
        this.activeTab = 'survey';
      } else if (this.pollId) {
        this.activeTab = 'poll';
      }

      // Load data
      this.loadResponses();

      // Initialize SignalR if sessionCode provided
      if (this.sessionCode) {
        this.initializeSignalR();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.isConnected) {
      this.signalrService.disconnect();
    }
  }

  /**
   * Load poll and survey responses
   */
  private loadResponses(): void {
    this.loading = true;
    this.error = null;

    if (this.pollId) {
      this.loadPollResponses();
    }

    if (this.surveyId) {
      this.loadSurveyResponses();
    }

    if (!this.pollId && !this.surveyId) {
      this.error = 'Please provide either a Poll ID or Survey ID';
      this.loading = false;
    }
  }

  /**
   * Load poll responses from API
   */
  private loadPollResponses(): void {
    if (!this.pollId) return;

    this.pollService.getPollResponsesByParticipant(this.participantId, this.pollId)
      .subscribe({
        next: (responses) => {
          this.pollResponses = responses;
          this.displayPollResponses = this.formatPollResponses(responses);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading poll responses:', error);
          this.error = 'Failed to load poll responses';
          this.loading = false;
        }
      });
  }

  /**
   * Load survey responses from API
   */
  private loadSurveyResponses(): void {
    if (!this.surveyId) return;

    this.surveyService.getSurveyResponsesByParticipant(this.participantId, this.surveyId)
      .subscribe({
        next: (responses) => {
          this.surveyResponses = responses;
          this.displaySurveyResponses = this.formatSurveyResponses(responses);
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading survey responses:', error);
          this.error = 'Failed to load survey responses';
          this.loading = false;
        }
      });
  }

  /**
   * Format poll responses for display
   */
  private formatPollResponses(responses: PollResponse[]): DisplayResponse[] {
    return responses.map(response => {
      const answers: string[] = [];

      // Handle single-choice
      if (response.selectedOptionId && response.optionLabel) {
        answers.push(response.optionLabel);
      }

      // Handle multi-select (comma-separated option IDs)
      if (response.selectedOptionIds) {
        const optionIds = response.selectedOptionIds.split(',').map(id => id.trim());
        answers.push(...optionIds.map(id => `Option ${id}`));
      }

      // Handle ranking
      if (response.optionRank) {
        answers.push(`Rank: ${response.optionRank}`);
      }

      // Handle text response
      if (response.responseText) {
        answers.push(response.responseText);
      }

      // Handle numeric response
      if (response.responseNumber !== undefined && response.responseNumber !== null) {
        answers.push(response.responseNumber.toString());
      }

      return {
        questionText: response.pollQuestion || response.pollTitle || 'Poll Question',
        questionType: response.selectedOptionIds ? 'multi-select' : 
                      response.optionRank ? 'ranking' : 
                      response.responseText ? 'text' : 'single-choice',
        answers: answers.length > 0 ? answers : ['No response'],
        rawResponse: response
      };
    });
  }

  /**
   * Format survey responses for display
   */
  private formatSurveyResponses(responses: SurveyResponse[]): DisplayResponse[] {
    return responses.map(response => {
      const answers: string[] = [];

      // Handle single-choice
      if (response.selected_option_id) {
        answers.push(`Option ${response.selected_option_id}`);
      }

      // Handle multi-select (comma-separated option IDs)
      if (response.selected_option_ids) {
        const optionIds = response.selected_option_ids.split(',').map(id => id.trim());
        answers.push(...optionIds.map(id => `Option ${id}`));
      }

      // Handle ranking
      if (response.option_rank) {
        answers.push(`Rank: ${response.option_rank}`);
      }

      // Handle text response
      if (response.response_text) {
        answers.push(response.response_text);
      }

      // Handle numeric/scale response
      if (response.response_number !== undefined && response.response_number !== null) {
        answers.push(`Rating: ${response.response_number}`);
      }

      return {
        questionText: `Question ${response.survey_question_id}`,
        questionType: response.selected_option_ids ? 'multi-select' : 
                      response.option_rank ? 'ranking' : 
                      response.response_text ? 'text' : 
                      response.response_number ? 'scale' : 'single-choice',
        answers: answers.length > 0 ? answers : ['No response'],
        rawResponse: response
      };
    });
  }

  /**
   * Initialize SignalR connection and event handlers
   */
  private initializeSignalR(): void {
    if (!this.sessionCode) return;

    // Initialize connection
    this.signalrService.initHubConnection(this.sessionCode);

    // Connection status
    const connectionSub = this.signalrService.connectionEstablished$.subscribe(connected => {
      this.isConnected = connected;
      if (connected) {
        console.log('SignalR connected');
        this.reconnecting = false;
        // Join appropriate session
        if (this.pollId) {
          this.signalrService.joinPollSession(this.sessionCode!);
        } else if (this.surveyId) {
          this.signalrService.joinSurveySession(this.sessionCode!);
        }
      } else if (this.reconnecting) {
        this.handleReconnection();
      }
    });

    // Poll/Survey started events
    const pollStartedSub = this.signalrService.pollStarted$.subscribe(data => {
      console.log('Poll started:', data);
      if (data.sessionCode === this.sessionCode) {
        this.showCountdown = true;
        this.countdownDuration = data.countdownDuration;
        this.loadPollResponses(); // Refresh data
      }
    });

    const surveyStartedSub = this.signalrService.surveyStarted$.subscribe(data => {
      console.log('Survey started:', data);
      const sessionCode = (data as any)['sessionCode'] || (data as any).sessionCode;
      if (sessionCode === this.sessionCode) {
        this.showCountdown = true;
        this.loadSurveyResponses(); // Refresh data
      }
    });

    // Countdown events
    const countdownTickSub = this.signalrService.countdownTick$.subscribe(data => {
      if (data.sessionCode === this.sessionCode) {
        console.log(`Countdown: ${data.remainingSeconds}s remaining`);
      }
    });

    const countdownCompletedSub = this.signalrService.countdownCompleted$.subscribe(sessionCode => {
      if (sessionCode === this.sessionCode) {
        console.log('Countdown completed');
        this.showCountdown = false;
        this.handleCountdownComplete();
      }
    });

    // Navigation events
    const nextQuestionSub = this.signalrService.nextQuestion$.subscribe(data => {
      if (data.sessionCode === this.sessionCode) {
        console.log('Moving to next question:', data.questionIndex);
        this.currentQuestionIndex = data.questionIndex;
        this.loadResponses(); // Refresh to show new question response
      }
    });

    const currentQuestionSub = this.signalrService.currentQuestion$.subscribe(data => {
      if (data.sessionCode === this.sessionCode) {
        console.log('Current question:', data.questionIndex);
        this.currentQuestionIndex = data.questionIndex;
      }
    });

    // Session ended
    const sessionEndedSub = this.signalrService.sessionEnded$.subscribe(data => {
      if (data.sessionCode === this.sessionCode) {
        console.log('Session ended:', data.message);
        alert('This session has ended. You will be redirected.');
        this.router.navigate(['/user/dashboard']);
      }
    });

    // Poll/Survey completed
    const pollCompletedSub = this.signalrService.pollCompleted$.subscribe(sessionCode => {
      if (sessionCode === this.sessionCode) {
        console.log('Poll completed');
        alert('Poll has been completed!');
      }
    });

    const surveyCompletedSub = this.signalrService.surveyCompleted$.subscribe(sessionCode => {
      if (sessionCode === this.sessionCode) {
        console.log('Survey completed');
        alert('Survey has been completed!');
      }
    });

    // Reconnection events
    const reconnectedSub = this.signalrService.reconnectedToSession$.subscribe(data => {
      if (data.sessionCode === this.sessionCode) {
        console.log('Reconnected to session');
        this.reconnecting = false;
        this.loadResponses(); // Reload data after reconnection
      }
    });

    const reconnectionFailedSub = this.signalrService.reconnectionFailed$.subscribe(data => {
      if (data.sessionCode === this.sessionCode) {
        console.error('Reconnection failed:', data.message);
        alert(`Failed to reconnect: ${data.message}`);
        this.router.navigate(['/user/dashboard']);
      }
    });

    // Store all subscriptions
    this.subscriptions.push(
      connectionSub,
      pollStartedSub,
      surveyStartedSub,
      countdownTickSub,
      countdownCompletedSub,
      nextQuestionSub,
      currentQuestionSub,
      sessionEndedSub,
      pollCompletedSub,
      surveyCompletedSub,
      reconnectedSub,
      reconnectionFailedSub
    );
  }

  /**
   * Handle reconnection after connection loss
   */
  private handleReconnection(): void {
    if (!this.sessionCode || !this.participantId) return;

    this.reconnecting = true;
    console.log('Attempting to reconnect...');

    this.signalrService.reconnectToActiveSession(
      this.sessionCode,
      this.participantId.toString()
    ).catch(error => {
      console.error('Reconnection error:', error);
      this.reconnecting = false;
    });
  }

  /**
   * Handle countdown completion - auto-navigate
   */
  private handleCountdownComplete(): void {
    console.log('Countdown completed - navigating to next question');
    // The backend should trigger NextQuestion event
    // Component will automatically load next response
  }

  /**
   * Switch between poll and survey tabs
   */
  switchTab(tab: 'poll' | 'survey'): void {
    this.activeTab = tab;
  }

  /**
   * Navigate back to dashboard
   */
  goBack(): void {
    this.router.navigate(['/user/dashboard']);
  }

  /**
   * Refresh current view
   */
  refresh(): void {
    this.loadResponses();
  }

  /**
   * Check if there are responses to display
   */
  get hasResponses(): boolean {
    if (this.activeTab === 'poll') {
      return this.displayPollResponses.length > 0;
    } else {
      return this.displaySurveyResponses.length > 0;
    }
  }
}
