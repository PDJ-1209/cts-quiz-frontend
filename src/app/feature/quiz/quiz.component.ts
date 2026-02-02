import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { HeaderComponent } from '../header/header.component';
import { QuestionComponent } from '../question/question.component';
import { OptionsComponent } from '../options/options.component';
import { SubmitComponent } from '../submit/submit.component';

type Question = { id: string; text: string; options: string[]; answer: string; };

@Component({
  selector: 'app-quiz-page',
  standalone: true,
  imports: [
    HeaderComponent, QuestionComponent, OptionsComponent, SubmitComponent,
    NgIf, MatSnackBarModule
  ],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizPageComponent {
  questions: Question[] = 
[
    { id: 'q1', text: 'Which decorator is used to define an Angular component?', options: ['@Injectable', '@Component', '@Directive', '@Pipe'], answer: '@Component' },
    { id: 'q2', text: 'What is the purpose of NgZone in Angular?', options: ['State management', 'Optimizes bundle size', 'Run code inside/outside Angular change detection', 'Registers custom pipes'], answer: 'Run code inside/outside Angular change detection' },
    { id: 'q3', text: 'Which Angular feature replaces NgModule in standalone APIs?', options: ['Signals', 'Standalone components', 'Observables', 'Zones'], answer: 'Standalone components' },
    { id: 'q4', text: 'What is the correct way to provide a service at the root level?', options: ['providers: [Service] in every component', '@Injectable({ providedIn: "root" })', 'Declaring in bootstrapApplication', 'Using useValue in any component'], answer: '@Injectable({ providedIn: "root" })' },
    { id: 'q5', text: 'Which RxJS operator is best for switching to a new inner observable and canceling the previous one?', options: ['mergeMap', 'concatMap', 'switchMap', 'exhaustMap'], answer: 'switchMap' },
    { id: 'q6', text: 'What is the default change detection strategy in Angular?', options: ['OnPush', 'Default', 'Manual', 'Detached'], answer: 'Default' },
    { id: 'q7', text: 'Which directive is used for structural rendering based on a boolean condition?', options: ['*ngFor', '*ngIf', '[ngClass]', '[ngStyle]'], answer: '*ngIf' },
    { id: 'q8', text: 'What is the recommended way to define routes with standalone components?', options: ['RouterModule.forRoot', 'provideRouter([...]) in main.ts', 'Routes in NgModule', 'Define in app.component.ts only'], answer: 'provideRouter([...]) in main.ts' },
    { id: 'q9', text: 'Which pipe is used to transform async values (Promises/Observables) in templates?', options: ['json', 'date', 'async', 'keyvalue'], answer: 'async' },
    { id: 'q10', text: 'How do you create a reactive form control?', options: ['new FormControl(initialValue)', '[(ngModel)]="value"', '@Input() control', 'useValue in providers'], answer: 'new FormControl(initialValue)' }
  ];

  
  currentIndex = 0;
  score = 0;
  selected: string | null = null;
  finished = false;

  constructor(private snack: MatSnackBar) {}

  get currentQuestion(): Question | null {
    return this.questions[this.currentIndex] ?? null;
  }

  onSelectedChange(value: string) {
    console.log('[QuizPage] onSelectedChange:', value);
    this.selected = value; // enables submit button
  }

  submitAnswer() {
    console.log('[QuizPage] submitAnswer called. selected =', this.selected);
    if (!this.currentQuestion || !this.selected) return;

    const isCorrect = this.selected === this.currentQuestion.answer;
    if (isCorrect) {
      this.score += 1;
      this.snack.open('Correct!', 'Close', { duration: 500 });
    } else {
      this.snack.open(`Incorrect. Correct: ${this.currentQuestion.answer}`, 'Close', { duration: 500 });
    }

    // advance
    this.selected = null;
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      console.log('[QuizPage] advanced to index', this.currentIndex);
    } else {
      this.finished = true;
      console.log('[QuizPage] finished');
    }
  }

  restart() {
    this.currentIndex = 0;
    this.score = 0;
    this.selected = null;
    this.finished = false;
    console.log('[QuizPage] restart');
  }
}
