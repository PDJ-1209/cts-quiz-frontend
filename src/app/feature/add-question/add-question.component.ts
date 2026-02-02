import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  Validators,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  AddQuestionService,
  QuizQuestion,
  QuestionType,
  Difficulty,
} from '../../services/add-question.service';
import { QrcodeComponent } from '../qrcode/qrcode.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

type OptionForm = FormGroup<{
  text: FormControl<string>;
  correct: FormControl<boolean>;
}>;

type AddQuestionForm = FormGroup<{
  quizName: FormControl<string>;
  question: FormControl<string>;
  options: FormArray<OptionForm>;
  type: FormControl<QuestionType>;
  difficulty: FormControl<Difficulty>;
  category: FormControl<string>;
  tags: FormArray<FormControl<string>>;
  timerSeconds: FormControl<number | null>;
}>;

@Component({
  selector: 'app-add-question',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrcodeComponent, MatSnackBarModule],
  templateUrl: './add-question.component.html',
  styleUrls: ['./add-question.component.css'],
})
export class AddQuestionComponent {
  private fb = inject(FormBuilder);
  private store = inject(AddQuestionService);
  private snackBar = inject(MatSnackBar);

  readonly questionTypes = ['Multiple Choice', 'True/False', 'Short Answer'] as const;
  readonly difficulties = ['Easy', 'Medium', 'Hard'] as const;

  suggestionsOpen = signal(false);
  csvStatus = signal<string>('');

  /** Quiz creation result for QR display */
  isQuizCreated = signal<boolean>(false);
  createdQuizNumber = signal<string>('');
  createdQuizId = signal<string | number>('');

  /** Shared signals from the store (for summary/preview sidebar) */
  readonly quizMeta = computed(() => this.store.quizMeta());
  readonly questions = computed(() => this.store.questions());

  /** create a typed option form group */
  private newOption(placeholder: string): OptionForm {
    return this.fb.group({
      text: this.fb.nonNullable.control<string>(placeholder, { validators: [Validators.required] }),
      correct: this.fb.nonNullable.control<boolean>(false),
    });
  }

  /** root form (typed) */
  form: AddQuestionForm = this.fb.group({
    quizName: this.fb.nonNullable.control<string>('', { 
      validators: [Validators.required, Validators.minLength(2)] 
    }),
    question: this.fb.nonNullable.control<string>('', {
      validators: [Validators.required, Validators.minLength(10)],
    }),
    options: this.fb.array<OptionForm>([
      this.newOption('Option 1'),
      this.newOption('Option 2'),
    ]),
    type: this.fb.nonNullable.control<QuestionType>('Multiple Choice'),
    difficulty: this.fb.nonNullable.control<Difficulty>('Medium'),
    category: this.fb.nonNullable.control<string>(''),
    tags: this.fb.array<FormControl<string>>([]),
    timerSeconds: this.fb.control<number | null>(null, { validators: [Validators.min(0)] }),
  });

  /** typed getters for template */
  get options(): FormArray<OptionForm> {
    return this.form.controls.options;
  }
  get tags(): FormArray<FormControl<string>> {
    return this.form.controls.tags;
  }

  /** Auto-fill for True/False; ensure at least two options for MCQ */
  constructor() {
    // Subscribe to type changes
    this.form.controls.type.valueChanges.subscribe((type) => {
      if (type === 'True/False') {
        this.options.clear();
        this.options.push(this.fb.group({
          text: this.fb.nonNullable.control<string>('True', { validators: [Validators.required] }),
          correct: this.fb.nonNullable.control<boolean>(false),
        }));
        this.options.push(this.fb.group({
          text: this.fb.nonNullable.control<string>('False', { validators: [Validators.required] }),
          correct: this.fb.nonNullable.control<boolean>(false),
        }));
      } else if (type === 'Multiple Choice' && this.options.length < 2) {
        this.options.clear();
        this.options.push(this.newOption('Option 1'));
        this.options.push(this.newOption('Option 2'));
      } else if (type === 'Short Answer') {
        // Short Answer does not require options; keep UI hidden
        this.options.clear();
      }
    });

    // Keep quiz basics updated; store generates a PREVIEW quiz number
    effect(() => {
      const name = this.form.controls.quizName.value?.trim();
      const cat = this.form.controls.category.value?.trim();
    //  const duration = 30; // If you plan a quiz-level duration, bind a field; keeping 30 for now
      if (name && cat) {
        this.store.setQuizBasics(name, cat);
      }
    });
  }

  /** UI actions */
  toggleSuggestion(): void {
    this.suggestionsOpen.update((v) => !v);
  }
  addOption(): void {
    if (this.form.controls.type.value === 'Short Answer') return;
    this.options.push(this.newOption(`Option ${this.options.length + 1}`));
  }
  removeOption(index: number): void {
    if (this.form.controls.type.value === 'Short Answer') return;
    if (this.options.length > 2) this.options.removeAt(index);
  }
  
  addTag(input: HTMLInputElement): void {
    const value = input.value.trim();
    if (value) {
      this.tags.push(this.fb.nonNullable.control<string>(value));
      input.value = '';
    }
  }
  removeTag(index: number): void {
    this.tags.removeAt(index);
  }

  /** CSV Functionality */
  downloadSampleCSV(): void {
    this.store.downloadSampleCSV();
    this.csvStatus.set('Sample CSV downloaded successfully!');
    setTimeout(() => this.csvStatus.set(''), 3000);
  }

  onCSVFileSelected(event: any): void {
    // Check if quiz name and category are filled
    const quizName = this.form.controls.quizName.value?.trim();
    const category = this.form.controls.category.value?.trim();
    
    if (!quizName || !category) {
      this.snackBar.open('⚠️ Please enter Quiz Name and Category before uploading CSV!', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      event.target.value = ''; // Clear the file input
      this.csvStatus.set('');
      return;
    }
    
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.csvStatus.set('Importing...');
      this.store.importFromCSV(file)
        .then(() => {
          this.csvStatus.set(`Successfully imported ${this.questions().length} questions!`);
          setTimeout(() => this.csvStatus.set(''), 5000);
          // Clear the file input
          event.target.value = '';
        })
        .catch(error => {
          console.error('CSV import error:', error);
          this.csvStatus.set(`Import failed: ${error.message}`);
          setTimeout(() => this.csvStatus.set(''), 5000);
          event.target.value = '';
        });
    } else {
      this.csvStatus.set('Please select a valid CSV file.');
      setTimeout(() => this.csvStatus.set(''), 3000);
    }
  }

  exportToCSV(): void {
    try {
      this.store.exportToCSV();
      this.csvStatus.set('Questions exported to CSV successfully!');
      setTimeout(() => this.csvStatus.set(''), 3000);
    } catch (error: any) {
      this.csvStatus.set(`Export failed: ${error.message}`);
      setTimeout(() => this.csvStatus.set(''), 3000);
    }
  }

  /** validation helpers */
  hasAtLeastTwoOptions(): boolean {
    const type = this.form.controls.type.value;
    if (type === 'Short Answer') return true;
    return this.options.length >= 2;
  }
  
  /** Prevent 'e', 'E', '+', '-' in number input */
  preventInvalidInput(event: KeyboardEvent): void {
    const invalidKeys = ['e', 'E', '+', '-'];
    if (invalidKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  /** Clear placeholder text on focus */
  clearPlaceholderText(event: FocusEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    const currentValue = this.options.at(index).controls.text.value;
    
    // Clear if it's a default placeholder like "Option 1", "Option 2", etc.
    if (currentValue && currentValue.match(/^Option \d+$/)) {
      this.options.at(index).controls.text.setValue('');
    }
  }
  
  hasAtLeastOneCorrect(): boolean {
    const type = this.form.controls.type.value;
    if (type === 'Short Answer') return true;
    
    const hasCorrect = this.options.controls.some((opt) => opt.controls.correct.value === true);
    console.log('[DEBUG] hasAtLeastOneCorrect check:', {
      type,
      optionsCount: this.options.controls.length,
      correctOptions: this.options.controls.map((opt, idx) => ({
        index: idx,
        text: opt.controls.text.value,
        correct: opt.controls.correct.value
      })),
      hasCorrect
    });
    
    return hasCorrect;
  }
  disableAdd(): boolean {
    return (
      this.form.invalid ||
      !this.hasAtLeastTwoOptions() ||
      !this.hasAtLeastOneCorrect()
    );
  }

  /** submit: push one question to the store (preview updates instantly) */
  onSubmit(): void {
    const type = this.form.controls.type.value;
    
    console.log('[DEBUG] onSubmit started, question type:', type);

    if (!this.hasAtLeastTwoOptions()) {
      this.snackBar.open('⚠️ Please provide at least two options for Multiple Choice / True/False.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      this.form.markAllAsTouched();
      return;
    }
    
    // Re-check correct options right before validation
    const hasCorrectNow = this.hasAtLeastOneCorrect();
    console.log('[DEBUG] Final hasAtLeastOneCorrect check:', hasCorrectNow);
    
    if (!hasCorrectNow) {
      this.snackBar.open('⚠️ Please mark at least one option as correct.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: QuizQuestion = {
      text: this.form.controls.question.value,
      type,
      difficulty: this.form.controls.difficulty.value,
      category: this.form.controls.category.value,
      tags: this.tags.controls.map((t) => t.value),
      timerSeconds: this.form.controls.timerSeconds.value ?? null,
      options:
        type === 'Short Answer'
          ? []
          : this.options.controls.map((opt) => ({
              text: opt.controls.text.value,
              isCorrect: opt.controls.correct.value,
            })),
    };

    // Push to the shared store so Preview sees it immediately
    this.store.addQuestion(payload);

    // Reset only the question fields; keep quiz basics
    this.resetForm();
  }

  // Convenience boolean for enabling "Create Quiz" button
  readonly canPublish = computed(() => {
    const name = this.form.controls.quizName.value?.trim();
    const cat = this.form.controls.category.value?.trim();
    const hasQuestions = this.questions().length > 0;
    return !!name && !!cat && hasQuestions;
  });

  /**
   * Create from the Preview tab:
   *  - calls store.createQuiz() to POST quiz + 10 questions + options to MVC controller
   *  - server generates final quiz number
   */
  
  /**
   * Delete a question from the preview
   */
  deleteQuestion(index: number): void {
    const snackBarRef = this.snackBar.open(`Delete question #${index + 1}?`, 'Delete', {
      duration: 0,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    
    snackBarRef.onAction().subscribe(() => {
      this.store.removeQuestion(index);
    });
  }

  async publishFromPreview() {
    if (!this.canPublish()) return; // guard
  
    // Enforce 1-25 questions (matches server rule)
    const total = this.questions().length;
    if (total < 1 || total > 25) {
      this.snackBar.open(`⚠️ You need between 1 and 25 questions to create the quiz (you currently have ${total}).`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    // Ensure quiz basics are set before creating
    const name = this.form.controls.quizName.value?.trim();
    const cat = this.form.controls.category.value?.trim();
    if (!name || !cat) {
      this.snackBar.open('⚠️ Please fill in both Quiz Name and Category fields.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }
    // Explicitly set quiz basics to ensure they're in the store
    this.store.setQuizBasics(name, cat);
  
    // Show confirmation snackbar
    const snackBarRef = this.snackBar.open(
      `Create Quiz: "${name}" | Category: ${cat} | Questions: ${total}`,
      'Confirm',
      {
        duration: 0,
        panelClass: ['confirm-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      }
    );
    
    const confirmed = await new Promise<boolean>((resolve) => {
      snackBarRef.onAction().subscribe(() => resolve(true));
      snackBarRef.afterDismissed().subscribe(() => resolve(false));
    });
    
    if (!confirmed) {
      return; // User cancelled
    }

    try {
      const res = await this.store.createQuiz();
      
      console.log('Full backend response:', res);
      
      // Backend returns data nested: { success, message, data: { quizNumber, quizId, ... } }
      const data = (res as any).data || res;
      const quizNumber = data.quizNumber;
      const quizId = data.quizId;
      
      if (quizNumber) {
        this.createdQuizNumber.set(quizNumber.toString());
        this.createdQuizId.set(quizId);
        this.isQuizCreated.set(true);
        
        this.snackBar.open(
          `✅ Quiz Created Successfully! | Quiz Number: ${quizNumber} | Quiz ID: ${quizId}`,
          'Close',
          {
            duration: 8000,
            panelClass: ['success-snackbar'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
        
        // Scroll to show QR code
        setTimeout(() => {
          const qrElement = document.querySelector('app-qrcode');
          if (qrElement) {
            qrElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      } else {
        this.snackBar.open(
          '⚠️ Quiz created but no Quiz Number returned from server.',
          'Close',
          {
            duration: 5000,
            panelClass: ['error-snackbar'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          }
        );
      }
      
      console.log(`SUCCESS: Quiz Created!\nQuiz Number: ${quizNumber}\nQuiz ID: ${quizId}`);
    } catch (err: any) {
      console.error(err);
      this.snackBar.open(
        `❌ Failed to create quiz: ${err?.message ?? 'Unknown error'}`,
        'Close',
        {
          duration: 6000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
    }
  }
  

  private resetForm(): void {
    this.form.patchValue({
      question: '',
      type: 'Multiple Choice',
      difficulty: 'Medium',
      timerSeconds: null,
    });
    // Reset options to 2 blank rows
    this.options.clear();
    this.options.push(this.newOption(''));
    this.options.push(this.newOption(''));
    // Clear tags
    this.tags.clear();
  }

  /**
   * Reset the entire form including quiz name and category
   * Used after successfully creating a quiz to prevent duplicates
   */
  private resetCompleteForm(): void {
    this.form.reset({
      quizName: '',
      question: '',
      type: 'Multiple Choice',
      difficulty: 'Medium',
      category: '',
      timerSeconds: null,
    });
    // Reset options to 2 blank rows
    this.options.clear();
    this.options.push(this.newOption('Option 1'));
    this.options.push(this.newOption('Option 2'));
    // Clear tags
    this.tags.clear();
  }

  
  /** Reset QR display for creating a new quiz */
  startNewQuiz() {
    this.isQuizCreated.set(false);
    this.createdQuizNumber.set('');
    this.createdQuizId.set('');
    this.store.clearAll();
    this.resetCompleteForm();
  }
}
