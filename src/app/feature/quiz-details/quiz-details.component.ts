// quiz-details.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-quiz-details',
  standalone: true,
  templateUrl: './quiz-details.component.html',
  styleUrls: ['./quiz-details.component.css']
})
export class QuizDetailsComponent {
  quizName = 'Live Quiz';
  quizId = 'QUIZ123';
}
