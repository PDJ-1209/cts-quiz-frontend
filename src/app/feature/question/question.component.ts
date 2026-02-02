import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Question } from '../../models/question.model';

@Component({
  selector: 'app-question',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './question.component.html',
  styleUrls: ['./question.component.css']
})
export class QuestionComponent {
  @Input({ required: true }) question!: Pick<Question, 'id' | 'text'>;
}
