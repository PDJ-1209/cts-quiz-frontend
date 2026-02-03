import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SurveyService } from '../../services/survey.service';
import { SignalrService } from '../../services/signalr.service';
import { CreateSurveyRequest, CreateQuestionRequest, CreateSessionRequest, PublishSurveyRequest } from '../../Models/isurvey';
import { AddQuestionService, QuizQuestion, QuestionType } from '../../services/add-question.service';

@Component({
  selector: 'app-create-survey',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './create-survey.component.html',
  styleUrls: ['./create-survey.component.css']
})
export class CreateSurveyComponent implements OnInit, OnDestroy {
  surveyForm!: FormGroup;
  sessionId: number | null = null;
  loading = false;
  isPreviewMode = false;
  employeeId = 1; // Map this to your actual Auth user ID
  
  @Output() switchToQuestionsTab = new EventEmitter<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private signalrService: SignalrService,
    private quizService: AddQuestionService
  ) {}

  ngOnInit(): void {
    const routeId = this.route.snapshot.params['sessionId'];
    this.sessionId = routeId ? +routeId : null;
    this.initForm();
  }

  initForm(): void {
    this.surveyForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      isAnonymous: [false],
      questions: this.fb.array([])
    });
    this.addQuestion();
  }

  get questions(): FormArray {
    return this.surveyForm.get('questions') as FormArray;
  }

  getOptions(index: number): FormArray {
    return this.questions.at(index).get('options') as FormArray;
  }

  addQuestion(): void {
    const questionGroup = this.fb.group({
      text: ['', Validators.required],
      type: ['single_choice', Validators.required],
      isRequired: [true],
      options: this.fb.array([
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required)
      ])
    });
    this.questions.push(questionGroup);
  }

  onPublish(): void {
    // Get form values directly
    const formValue = this.surveyForm.getRawValue();
    const title = formValue.title?.trim();
    const questions = formValue.questions || [];

    // Basic validation
    if (!title || title.length < 3) {
      alert('Survey title must be at least 3 characters');
      return;
    }

    if (!questions || questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.text || !q.text.trim()) {
        alert(`Question ${i + 1}: Text is required`);
        return;
      }

      if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const validOptions = q.options ? q.options.filter((opt: string) => opt && opt.trim().length > 0) : [];
        if (validOptions.length < 2) {
          alert(`Question ${i + 1}: Choice questions must have at least 2 options`);
          return;
        }
      }
    }

    this.loading = true;
    console.log('All validations passed. Starting publish process...');

    const now = new Date();
    const end = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // +2 hours

    // Step 1: Create Session
    const sessionPayload: CreateSessionRequest = {
      title: title,
      employeeId: this.employeeId,
      startAt: now.toISOString(),
      endAt: end.toISOString(),
      status: 'Waiting'
    };

    console.log('Step 1: Creating session with payload:', sessionPayload);

    this.surveyService.createSession(sessionPayload).subscribe({
      next: (sessionRes: any) => {
        console.log('Step 1 SUCCESS - Full response:', sessionRes);
        
        // Extract sessionId with fallback
        let sessionId = sessionRes?.sessionId || sessionRes?.id;
        
        // Try to get from nested data property
        if (!sessionId && sessionRes?.data) {
          sessionId = sessionRes.data.sessionId || sessionRes.data.id;
        }

        // Try to convert to number if it's a string
        if (sessionId) {
          sessionId = parseInt(sessionId, 10);
        }

        console.log('Extracted sessionId:', sessionId, 'Type:', typeof sessionId);

        if (!sessionId || isNaN(sessionId)) {
          console.error('Session response invalid:', sessionRes);
          this.loading = false;
          alert('Session creation failed: Invalid session ID');
          return;
        }

        // Step 2: Build Survey Payload
        const surveyQuestions: CreateQuestionRequest[] = questions.map((q: any, i: number) => {
          const questionPayload: any = {
            question_text: q.text.trim(),
            question_type: q.type,
            is_required: q.isRequired !== undefined ? q.isRequired : true,
            question_order: i + 1
          };

          // Add scale for rating
          if (q.type === 'rating') {
            questionPayload.scale_min = 1;
            questionPayload.scale_max = 5;
          }

          // Add options for choices
          if ((q.type === 'single_choice' || q.type === 'multiple_choice') && q.options) {
            const validOptions = q.options
              .filter((opt: string) => opt && opt.trim().length > 0)
              .map((opt: string, oi: number) => ({
                option_text: opt.trim(),
                display_order: oi + 1
              }));

            if (validOptions.length > 0) {
              questionPayload.options = validOptions;
            }
          }

          return questionPayload;
        });

        // Step 3: Create Survey
        const surveyPayload: CreateSurveyRequest = {
          session_id: sessionId,
          title: title,
          description: formValue.description?.trim() || '',
          is_anonymous: formValue.isAnonymous === true,
          questions: surveyQuestions
        };

        console.log('Step 2: Creating survey with payload:', JSON.stringify(surveyPayload, null, 2));

        this.surveyService.createSurvey(surveyPayload).subscribe({
          next: (surveyRes: any) => {
            console.log('Step 2 SUCCESS - Full response:', surveyRes);

            // Extract surveyId
            let surveyId = surveyRes?.surveyId || surveyRes?.id;
            
            if (!surveyId && surveyRes?.data) {
              surveyId = surveyRes.data.surveyId || surveyRes.data.id;
            }

            if (surveyId) {
              surveyId = parseInt(surveyId, 10);
            }

            console.log('Extracted surveyId:', surveyId, 'Type:', typeof surveyId);

            if (!surveyId || isNaN(surveyId)) {
              console.error('Survey response invalid:', surveyRes);
              this.loading = false;
              alert('Survey creation failed: Invalid survey ID');
              return;
            }

            // Step 4: Publish Survey
            const publishPayload: PublishSurveyRequest = {
              surveyId: surveyId,
              employeeId: this.employeeId
            };

            console.log('Step 3: Publishing survey with payload:', publishPayload);

            this.surveyService.publishSurvey(publishPayload).subscribe({
              next: (publishRes: any) => {
                console.log('Step 3 SUCCESS - Published:', publishRes);
                
                // Step 5: Initialize SignalR and Navigate
                console.log('Step 4: Initializing SignalR for sessionId:', sessionId);
                this.signalrService.initHubConnection(sessionId, this.employeeId);
                
                console.log('Step 5: Navigating to dashboard');
                this.router.navigate(['/host/dashboard', sessionId]).then(() => {
                  console.log('Navigation completed successfully');
                  this.loading = false;
                }).catch((err) => {
                  console.error('Navigation error:', err);
                  this.loading = false;
                });
              },
              error: (err) => {
                console.error('Step 3 FAILED - Publish Error:', err);
                this.loading = false;
                const errorMsg = err?.error?.message || err?.error?.error || err?.message || 'Unknown error';
                alert(`Failed to publish survey: ${errorMsg}`);
              }
            });
          },
          error: (err) => {
            console.error('Step 2 FAILED - Survey Creation Error:', err);
            this.loading = false;
            const errorMsg = err?.error?.message || err?.error?.error || err?.message || 'Unknown error';
            alert(`Failed to create survey: ${errorMsg}`);
          }
        });
      },
      error: (err) => {
        console.error('Step 1 FAILED - Session Creation Error:', err);
        this.loading = false;
        const errorMsg = err?.error?.message || err?.error?.error || err?.message || 'Unknown error';
        alert(`Failed to create session: ${errorMsg}`);
      }
    });
  }

  removeQuestion(index: number): void {
    if (this.questions.length > 1) this.questions.removeAt(index);
  }

  addOption(qIndex: number): void {
    this.getOptions(qIndex).push(this.fb.control('', Validators.required));
  }

  removeOption(qIndex: number, oIndex: number): void {
    if (this.getOptions(qIndex).length > 2) this.getOptions(qIndex).removeAt(oIndex);
  }

  /**
   * Integrate with quiz creation system - Convert survey to quiz format
   */
  async createQuizFromSurvey(): Promise<void> {
    if (this.surveyForm.valid && this.surveyForm.value.title && this.surveyForm.value.questions.length > 0) {
      try {
        this.loading = true;
        
        // Set quiz basics in the quiz service
        this.quizService.setQuizBasics(
          this.surveyForm.value.title,
          this.surveyForm.value.category || 'General'
        );
        
        // Add each question to the quiz service
        for (const question of this.surveyForm.value.questions) {
          const quizQuestion: QuizQuestion = {
            text: question.text,
            type: (question.type === 'multiple-choice' ? 'Multiple Choice' : 'True/False') as QuestionType,
            difficulty: 'Medium',
            category: this.surveyForm.value.category || 'General',
            tags: [],
            timerSeconds: null,
            options: question.options?.map((opt: string, index: number) => ({
              text: opt,
              isCorrect: index === 0 // First option as correct for demo
            })) || [
              { text: 'True', isCorrect: true },
              { text: 'False', isCorrect: false }
            ]
          };
          
          // Use addQuestion method directly (it's void)
          try {
            this.quizService.addQuestion(quizQuestion);
          } catch (error) {
            console.warn('Failed to add question:', error);
          }
        }
        
        console.log('✅ Survey converted to quiz successfully');
        alert('Survey has been converted to quiz format! Switch to Questions tab to see the results.');
        this.switchToQuestionsTab.emit();
        
      } catch (error) {
        console.error('❌ Error creating quiz from survey:', error);
        alert('Failed to create quiz from survey. Please try again.');
      } finally {
        this.loading = false;
      }
    } else {
      alert('Please fill in the survey title and add at least one question.');
    }
  }

  ngOnDestroy(): void {
    // Fix for Error 3: Using correct method name 'disconnect'
    this.signalrService.disconnect();
  }
}