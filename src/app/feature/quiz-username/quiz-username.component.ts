import { Component, OnInit, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ParticipantService } from '../../services/participant.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-quiz-username',
  standalone: true,
  imports: [FormsModule, CommonModule, MatSnackBarModule],
  templateUrl: './quiz-username.component.html',
  styleUrls: ['./quiz-username.component.css']
})
export class QuizUsernameComponent implements OnInit {
  userName = '';
  showWarning = false;
  sessionCode = '';
  isValidating = false;
  private lastBackWarnAt = 0;

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private participantService: ParticipantService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.lockBackNavigation();
    // Get session code from query params
    this.route.queryParams.subscribe(params => {
      this.sessionCode = params['code'] || '';
      if (this.sessionCode) {
        this.validateSession();
      } else {
        this.snackBar.open('⚠️ No quiz code provided', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        this.router.navigate(['/participant']);
      }
    });
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(): void {
    this.lockBackNavigation();

    const now = Date.now();
    if (now - this.lastBackWarnAt > 2000) {
      this.lastBackWarnAt = now;
      this.snackBar.open('Back navigation is disabled while joining the quiz.', 'Close', { duration: 2000 });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    event.preventDefault();
    event.returnValue = '';
  }

  private lockBackNavigation(): void {
    window.history.pushState(null, '', window.location.href);
  }

  async validateSession() {
    this.isValidating = true;
    try {
      const validation = await this.participantService.validateSessionCode(this.sessionCode);
      
      if (!validation.isValid) {
        this.snackBar.open(`❌ ${validation.message}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        setTimeout(() => {
          this.router.navigate(['/participant']);
        }, 3000);
      } else {
        // Store session data for countdown
        localStorage.setItem('sessionData', JSON.stringify(validation));
        localStorage.setItem('quizTitle', validation.quizTitle || 'Quiz');
      }
    } catch (error: any) {
      this.snackBar.open('❌ Failed to validate quiz code', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      setTimeout(() => {
        this.router.navigate(['/participant']);
      }, 3000);
    } finally {
      this.isValidating = false;
    }
  }

  validateName(value: string) {
    const hasInvalidChars = /[^a-zA-Z\s]/.test(value);
    this.showWarning = hasInvalidChars;
    this.userName = value;
  }

  async joinQuiz() {
    if (!this.showWarning && this.userName.trim()) {
      const cleaned = this.userName.trim();
      
      try {
        // Join session and create participant entry
        const participant = await this.participantService.joinSession({
          sessionCode: this.sessionCode,
          nickname: cleaned,
          employeeId: this.authService.currentUser()?.employeeId
        });

        // Store participant data
        localStorage.setItem('participantName', cleaned);
        localStorage.setItem('participantId', participant.participantId.toString());
        localStorage.setItem('sessionId', participant.sessionId.toString());
        localStorage.setItem('sessionCode', this.sessionCode);

        // Go to waiting room (countdown) before quiz starts
        this.router.navigate(['/countdown'], { 
          queryParams: { code: this.sessionCode }
        });
      } catch (error: any) {
        const friendlyMessage = this.getJoinErrorMessage(error);
        this.snackBar.open(`⚠️ ${friendlyMessage}`, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    } else {
      this.snackBar.open('⚠️ Please enter a valid name before joining.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }

  private getJoinErrorMessage(error: any): string {
    const rawMessage = error?.message || 'Failed to join quiz.';
    const prefix = 'Failed to join session:';
    if (rawMessage.startsWith(prefix)) {
      return rawMessage.replace(prefix, '').trim();
    }
    return rawMessage;
  }
}
