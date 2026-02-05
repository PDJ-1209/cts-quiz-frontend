import { Component, OnInit, Output, EventEmitter, AfterViewInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { PollService } from '../../services/poll.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { Poll, CreatePollRequest } from '../../models/ipoll';
import { TutorialService, TutorialStep } from '../../services/tutorial.service';

@Component({
  selector: 'app-create-poll',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './create-poll.component.html',
  styleUrls: ['./create-poll.component.css']
})
export class CreatePollComponent implements OnInit, AfterViewInit {
  pollForm!: FormGroup;
  submitted = false;
  loading = false;
  successMessage = '';
  errorMessage = '';
  sessionId: number | null = null;

  // Header properties
  hostName = 'Poll Host'; // You can make this dynamic later
  currentDateTime = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  @Output() switchToQuestionsTab = new EventEmitter<void>();

  // Tutorial properties
  private tutorialService = inject(TutorialService);
  readonly tutorialActive = computed(() => this.tutorialService.isActive());
  readonly currentTutorialStep = computed(() => this.tutorialService.currentStep());
  readonly tutorialSteps = computed(() => this.tutorialService.steps());

  private tutorialStepDefinitions: TutorialStep[] = [
    {
      id: 'poll-title',
      title: '📊 Poll Title',
      description: 'Enter a clear and engaging title for your poll to attract participants.',
      targetElement: 'input[formControlName="pollTitle"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'poll-question',
      title: '❓ Poll Question',
      description: 'Write your poll question clearly. This is what participants will see and respond to.',
      targetElement: 'textarea[formControlName="pollQuestion"]',
      position: 'bottom',
      skipable: true
    },
    {
      id: 'question-types',
      title: '🔄 Question Types',
      description: 'Choose from predefined options like True/False, Yes/No, Agree/Disagree, or create custom options.',
      targetElement: '.question-type-selector',
      position: 'left',
      skipable: true
    },
    {
      id: 'publish-poll',
      title: '🚀 Publish Poll',
      description: 'When you\'re ready, publish your poll to make it available for participants!',
      targetElement: '.btn-success',
      position: 'top',
      skipable: true
    }
  ];

  questionTypes: { value: string; label: string; option1: string; option2: string }[] = [
    { value: 'true_false', label: 'True/False', option1: 'True', option2: 'False' },
    { value: 'yes_no', label: 'Yes/No', option1: 'Yes', option2: 'No' },
    { value: 'agree_disagree', label: 'Agree/Disagree', option1: 'Agree', option2: 'Disagree' },
    { value: 'custom', label: 'Custom', option1: '', option2: '' }
  ];
  authService: any;

  constructor(
    private formBuilder: FormBuilder,
    private pollService: PollService,
    private router: Router,
    private route: ActivatedRoute,
    private dashboardStatsService: DashboardStatsService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.sessionId = params['sessionId'] ? parseInt(params['sessionId']) : null;
    });

    this.pollForm = this.formBuilder.group({
      pollTitle: ['', Validators.required],
      pollQuestion: ['', Validators.required],
      pollAnonymous: [false],
      questionType: ['custom', Validators.required],
      options: this.formBuilder.array([])
    });

    // Add initial two options (minimum required)
    this.addOption();
    this.addOption();
    this.onQuestionTypeChange();
  }

  get f() {
    return this.pollForm.controls;
  }

  get options(): FormArray {
    return this.pollForm.get('options') as FormArray;
  }

  createOptionFormGroup(): FormGroup {
    return this.formBuilder.group({
      optionLabel: ['', Validators.required]
    });
  }

  addOption(): void {
    if (!this.isCustomType()) {
      return;
    }
    this.options.push(this.createOptionFormGroup());
  }

  removeOption(index: number): void {
    if (this.options.length > 2) {
      this.options.removeAt(index);
    }
  }

  onQuestionTypeChange(): void {
    const questionType = this.pollForm.get('questionType')?.value;
    const typeInfo = this.questionTypes.find(t => t.value === questionType);

    while (this.options.length < 2) {
      this.options.push(this.createOptionFormGroup());
    }

    if (questionType !== 'custom') {
      while (this.options.length > 2) {
        this.options.removeAt(this.options.length - 1);
      }

      if (typeInfo) {
        this.options.at(0).patchValue({ optionLabel: typeInfo.option1 });
        this.options.at(1).patchValue({ optionLabel: typeInfo.option2 });
      }

      this.options.controls.forEach((control) => control.disable({ emitEvent: false }));
      this.options.at(0).enable({ emitEvent: false });
      this.options.at(1).enable({ emitEvent: false });
    } else {
      this.options.controls.forEach((control) => control.enable({ emitEvent: false }));
    }
  }

  isCustomType(): boolean {
    return this.pollForm.get('questionType')?.value === 'custom';
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formValue = this.pollForm.value;
    
    // Validate Title
    if (!formValue.pollTitle || formValue.pollTitle.trim().length === 0) {
      this.errorMessage = 'Title is required and must be between 3 and 200 characters';
      return;
    }
    if (formValue.pollTitle.trim().length < 3 || formValue.pollTitle.trim().length > 200) {
      this.errorMessage = 'Title must be between 3 and 200 characters';
      return;
    }

    // Validate Question
    if (!formValue.pollQuestion || formValue.pollQuestion.trim().length === 0) {
      this.errorMessage = 'Question is required and must be between 5 and 500 characters';
      return;
    }
    if (formValue.pollQuestion.trim().length < 5 || formValue.pollQuestion.trim().length > 500) {
      this.errorMessage = 'Question must be between 5 and 500 characters';
      return;
    }

    // Validate that at least 2 options exist
    if (!formValue.options || formValue.options.length < 2) {
      this.errorMessage = 'Poll must have at least 2 options';
      return;
    }

    // Validate all options have labels
    const validOptions = formValue.options.every((opt: any) => opt.optionLabel && opt.optionLabel.trim().length > 0);
    if (!validOptions) {
      this.errorMessage = 'All options must have a label';
      return;
    }

    this.loading = true;
    // Use a default user ID since authService might not be available
    const employeeId = 1;

    // Build the payload matching backend expectations (PascalCase)
    const payload = {
      SessionId: this.sessionId || 1,
      Title: formValue.pollTitle.trim(),
      Question: formValue.pollQuestion.trim(),
      IsAnonymous: formValue.pollAnonymous,
      SelectionType: 'single',
      Options: formValue.options.map((opt: any, index: number) => ({
        Label: opt.optionLabel.trim(),
        Order: index + 1  // Backend expects positive number starting from 1
      }))
    };

    console.log(' Poll Payload:', payload);
    console.log(' Form Value Before Send:', formValue);

    this.pollService.createPoll(payload as any).subscribe({
      next: (response) => {
        this.successMessage = 'Poll created successfully!';
        this.loading = false;
        
        // Update dashboard stats
        this.dashboardStatsService.incrementPollCount();
        
        setTimeout(() => {
          this.router.navigate(['/host']);
        }, 2000);
      },
      error: (error) => {
        console.error('Error creating poll:', error);
        this.errorMessage = error?.message || 'Failed to create poll. Please check your API connection.';
        this.loading = false;
      }
    });
  }

  getSelectedTypeLabel(): string {
    const questionType = this.pollForm.get('questionType')?.value;
    const typeInfo = this.questionTypes.find(t => t.value === questionType);
    return typeInfo ? typeInfo.label : 'Custom';
  }

  convertToQuiz(): void {
    if (this.pollForm.valid) {
      // Convert poll to quiz format logic
      alert('Poll converted to quiz format! Switching to Questions tab.');
      this.switchToQuestionsTab.emit();
    } else {
      alert('Please fill in all required fields before converting.');
    }
  }

  ngAfterViewInit(): void {
    // Start tutorial after view is fully initialized
    setTimeout(() => {
      this.startTutorial();
    }, 1000);
  }

  // Tutorial methods
  startTutorial(): void {
    if (this.tutorialService.shouldAutoStart('polls')) {
      console.log('Auto-starting tutorial for polls component');
      this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'polls');
    } else {
      console.log('Tutorial already seen for polls component');
    }
  }

  resetTutorial(): void {
    this.tutorialService.resetTutorial('polls');
    this.tutorialService.startTutorial(this.tutorialStepDefinitions, 'polls');
  }

  nextTutorialStep(): void {
    this.tutorialService.nextStep();
  }

  previousTutorialStep(): void {
    this.tutorialService.previousStep();
  }

  skipTutorial(): void {
    this.tutorialService.skipTutorial();
  }

  getCurrentStep(): TutorialStep | null {
    return this.tutorialService.getCurrentStepData();
  }

  getSpotlightPosition(): { top: string; left: string; width: string; height: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      top: `${rect.top - 5}px`,
      left: `${rect.left - 5}px`,
      width: `${rect.width + 10}px`,
      height: `${rect.height + 10}px`
    };
  }

  getPopupPosition(): { top: string; left: string } | null {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return null;

    const element = document.querySelector(currentStep.targetElement);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const popupWidth = 350;
    const popupHeight = 200;

    let top = rect.top;
    let left = rect.left;

    switch (currentStep.position) {
      case 'bottom':
        top = rect.bottom + 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'top':
        top = rect.top - popupHeight - 10;
        left = rect.left + (rect.width / 2) - (popupWidth / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.left - popupWidth - 10;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (popupHeight / 2);
        left = rect.right + 10;
        break;
    }

    // Ensure popup stays within viewport
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (top < 10) top = 10;
    if (top + popupHeight > window.innerHeight - 10) top = window.innerHeight - popupHeight - 10;

    return {
      top: `${top}px`,
      left: `${left}px`
    };
  }
}
