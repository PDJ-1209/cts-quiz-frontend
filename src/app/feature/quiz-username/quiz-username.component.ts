import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-quiz-username',
  standalone: true,
  imports: [FormsModule, CommonModule, MatSnackBarModule],
  templateUrl: './quiz-username.component.html',
  styleUrls: ['./quiz-username.component.css']
})
export class QuizUsernameComponent {
  userName = '';
  showWarning = false;

  constructor(private router: Router, private snackBar: MatSnackBar) {}

  validateName(value: string) {
    const hasInvalidChars = /[^a-zA-Z\s]/.test(value);
    this.showWarning = hasInvalidChars;
    this.userName = value;
  }

  joinQuiz() {
    if (!this.showWarning && this.userName.trim()) {
      const cleaned = this.userName.trim();
      localStorage.setItem('participantName', cleaned);
      // Go to waiting room (countdown) before quiz starts
      this.router.navigate(['/countdown'], { state: { name: cleaned } });
    } else {
      this.snackBar.open('⚠️ Please enter a valid name before joining.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }
}
