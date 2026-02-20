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

  @HostListener('window:popstate')
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
      console.log('[QuizUsername] Validation response:', validation);
      
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
<<<<<<< HEAD
        // Store quizId for feedback later
        if (validation.quizId) {
          localStorage.setItem('currentQuizId', validation.quizId.toString());
        }
=======
        localStorage.setItem('sessionType', validation.sessionType || 'Quiz');
        
        // For scheduled sessions, startedAt contains the scheduled time
        // For active sessions, it contains the actual start time
        // Only default to current time if startedAt is truly missing (shouldn't happen)
        const startTime = validation.startedAt || new Date().toISOString();
        localStorage.setItem('startTime', startTime);
        
        // Store session status to help countdown components distinguish scheduled vs active
        localStorage.setItem('sessionStatus', validation.status || 'Active');
        
        console.log('[QuizUsername] ===== SESSION VALIDATION DEBUG =====');
        console.log('[QuizUsername] Raw validation.startedAt:', validation.startedAt);
        console.log('[QuizUsername] Stored startTime:', startTime);
        console.log('[QuizUsername] Parsed as Date:', new Date(startTime));
        console.log('[QuizUsername] Current time:', new Date());
        console.log('[QuizUsername] Session validation:', {
          sessionType: validation.sessionType,
          status: validation.status,
          startTime: startTime,
          isScheduled: validation.status?.toLowerCase() === 'scheduled',
          timeDifference: new Date(startTime).getTime() - new Date().getTime()
        });
        console.log('[QuizUsername] ===================================');
        
        // Store title based on session type
        if (validation.sessionType === 'Survey') {
          localStorage.setItem('surveyTitle', validation.quizTitle || 'Survey');
          localStorage.setItem('title', validation.quizTitle || 'Survey');
        } else if (validation.sessionType === 'Poll') {
          localStorage.setItem('pollTitle', validation.quizTitle || 'Poll');
        }
        
        // Store poll/survey IDs if present
        if (validation.pollId) {
          localStorage.setItem('pollId', validation.pollId.toString());
          console.log('[QuizUsername] Stored pollId:', validation.pollId);
        }
        if (validation.surveyId) {
          localStorage.setItem('surveyId', validation.surveyId.toString());
          console.log('[QuizUsername] Stored surveyId:', validation.surveyId);
        }
        console.log('[QuizUsername] Stored sessionType:', validation.sessionType || 'Quiz');
>>>>>>> 2e73df1791eb660398b638e6660e33385d16d837
      }
    } catch (error: any) {
      this.snackBar.open('❌ Failed to validate session code', 'Close', {
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
      
      // Get employee ID from logged-in user (stored during authentication)
      let employeeId = '';
      const authUserStr = localStorage.getItem('auth_user');
      
      if (authUserStr) {
        try {
          const authUser = JSON.parse(authUserStr);
          employeeId = authUser.employeeId || authUser.userId || '';
        } catch (e) {
          console.error('Failed to parse auth_user:', e);
        }
      }
      
      if (!employeeId) {
        this.snackBar.open('⚠️ No user session found. Please login first.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.router.navigate(['/']);
        return;
      }
      
      console.log('[QuizUsername] Joining with employeeId:', employeeId);
      
      try {
        // Join session and create participant entry
        const participant = await this.participantService.joinSession({
          sessionCode: this.sessionCode,
          nickname: cleaned,
          employeeId: employeeId
        });

        // Store participant data
        localStorage.setItem('participantName', cleaned);
        localStorage.setItem('participantId', participant.participantId.toString());
        localStorage.setItem('sessionId', participant.sessionId.toString());
        localStorage.setItem('sessionCode', this.sessionCode);

        // Determine session type and route appropriately
        const sessionType = localStorage.getItem('sessionType') || 'Quiz';
        const pollId = localStorage.getItem('pollId');
        const surveyId = localStorage.getItem('surveyId');
        
        console.log('[QuizUsername] Routing with sessionType:', sessionType, 'pollId:', pollId, 'surveyId:', surveyId);
        
        if (sessionType === 'Poll' && pollId) {
          // Route to poll countdown/waiting room
          console.log('[QuizUsername] Routing to poll-countdown');
          this.snackBar.open('✅ Joined poll successfully!', 'Close', { duration: 2000 });
          this.router.navigate(['/poll-countdown'], {
            queryParams: { 
              sessionCode: this.sessionCode,
              participantId: participant.participantId,
              pollId: pollId
            }
          });
        } else if (sessionType === 'Survey' && surveyId) {
          // Route to survey countdown/waiting room
          console.log('[QuizUsername] Routing to survey-countdown');
          this.snackBar.open('✅ Joined survey successfully!', 'Close', { duration: 2000 });
          this.router.navigate(['/survey-countdown'], {
            queryParams: { 
              sessionCode: this.sessionCode,
              participantId: participant.participantId,
              surveyId: surveyId
            }
          });
        } else {
          // Default to quiz flow - go to waiting room (countdown) before quiz starts
          console.log('[QuizUsername] Routing to countdown (quiz)');
          this.router.navigate(['/countdown'], { 
            queryParams: { code: this.sessionCode }
          });
        }
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
