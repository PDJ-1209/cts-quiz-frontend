import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
  animations: [
    trigger('fadeInUp', [
      state('in', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate('800ms ease-out')
      ])
    ]),
    trigger('slideIn', [
      state('in', style({ transform: 'translateX(0)' })),
      transition('void => *', [
        style({ transform: 'translateX(-100%)' }),
        animate('600ms ease-out')
      ])
    ]),
    trigger('pulse', [
      state('in', style({ transform: 'scale(1)' })),
      transition('* => *', [
        animate('1s ease-in-out', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.05)', offset: 0.5 }),
          style({ transform: 'scale(1)', offset: 1 })
        ]))
      ])
    ])
  ]
})
export class LandingPageComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private destroy$ = new Subject<void>();
  
  // Signals for animations
  showHero = signal(false);
  showFeatures = signal(false);
  showStats = signal(false);
  
  // UI state
  showHostOptions = false;
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  // Quiz statistics
  stats = {
    totalQuizzes: 1250,
    activeUsers: 50000,
    questionsCreated: 25000,
    companiesUsing: 500
  };
  
  // Impact statistics for Cognizant branding
  impactStats = [
    {
      icon: 'fas fa-building',
      value: '500+',
      label: 'Enterprise Clients',
      trend: '+25% YoY'
    },
    {
      icon: 'fas fa-users',
      value: '2.5M+',
      label: 'Active Learners',
      trend: '+40% Growth'
    },
    {
      icon: 'fas fa-brain',
      value: '85%',
      label: 'Skill Improvement',
      trend: 'Proven Results'
    },
    {
      icon: 'fas fa-globe',
      value: '50+',
      label: 'Countries',
      trend: 'Global Reach'
    }
  ];
  // Features data - Cognizant enterprise focus
  features = [
    {
      icon: 'fas fa-chart-analytics',
      title: 'AI-Powered Analytics',
      description: 'Advanced machine learning insights to identify skill gaps and optimize learning paths with predictive analytics.'
    },
    {
      icon: 'fas fa-shield-check',
      title: 'Enterprise Security',
      description: 'SOC 2 Type II compliance, end-to-end encryption, and enterprise-grade security protocols for global organizations.'
    },
    {
      icon: 'fas fa-cloud-upload-alt',
      title: 'Cloud-Native Platform',
      description: 'Scalable microservices architecture with 99.9% uptime, auto-scaling, and global CDN distribution.'
    },
    {
      icon: 'fas fa-brain',
      title: 'Adaptive Learning',
      description: 'Personalized learning experiences with AI-driven assessments, interactive quizzes, and comprehensive surveys to adapt content based on performance.'
    },
    {
      icon: 'fas fa-poll-h',
      title: 'Smart Assessment Suite',
      description: 'Create dynamic quizzes and interactive surveys with real-time analytics, automatic scoring, and seamless conversion between formats.'
    },
    {
      icon: 'fas fa-globe',
      title: 'Global Deployment',
      description: 'Multi-region deployment with localization support for 50+ countries and compliance with local regulations.'
    },
    {
      icon: 'fas fa-integration',
      title: 'Enterprise Integration',
      description: 'Seamless integration with HRIS, LMS, and existing enterprise systems through comprehensive API gateway.'
    }
  ];
  
  ngOnInit() {
    // Initialize component with error handling
    try {
      this.initializeAnimations();
      this.loadInitialData();
    } catch (error) {
      this.handleError(error, 'component initialization');
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize animations with error handling
   */
  private initializeAnimations(): void {
    try {
      // Staggered animation triggers
      setTimeout(() => this.showHero.set(true), 300);
      setTimeout(() => this.showFeatures.set(true), 800);
      setTimeout(() => this.showStats.set(true), 1200);
    } catch (error) {
      console.warn('Animation initialization error:', error);
      // Set all animations to show immediately if there's an error
      this.showHero.set(true);
      this.showFeatures.set(true);
      this.showStats.set(true);
    }
  }

  /**
   * Load initial data with error handling
   */
  private loadInitialData(): void {
    this.isLoading.set(true);
    this.clearError();

    // Simulate loading process with error handling
    of(null).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        this.handleError(error, 'loading initial data');
        return of(null);
      })
    ).subscribe({
      next: () => {
        // Data loaded successfully
        this.isLoading.set(false);
      },
      error: (error) => {
        this.handleError(error, 'loading initial data');
      }
    });
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Handle errors with user-friendly messages
   */
  private handleError(error: any, operation: string): void {
    console.error(`Error in ${operation}:`, error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    this.error.set(errorMessage);
    this.isLoading.set(false);
  }
  
  navigateToQuizCreation() {
    try {
      this.clearError();
      this.router.navigate(['/host/dashboard']).catch(error => {
        this.handleError(error, 'navigation to host dashboard');
      });
      this.showHostOptions = false;
    } catch (error) {
      this.handleError(error, 'navigateToQuizCreation');
    }
  }

  navigateToSurveyCreation() {
    try {
      this.clearError();
      this.router.navigate(['/host/dashboard']).catch(error => {
        this.handleError(error, 'navigation to host dashboard');
      });
      this.showHostOptions = false;
    } catch (error) {
      this.handleError(error, 'navigateToSurveyCreation');
    }
  }

  navigateToPollCreation() {
    try {
      this.clearError();
      this.router.navigate(['/host/dashboard']).catch(error => {
        this.handleError(error, 'navigation to host dashboard');
      });
      this.showHostOptions = false;
    } catch (error) {
      this.handleError(error, 'navigateToPollCreation');
    }
  }
  
  navigateToHost() {
    try {
      // Legacy method - redirect to quiz creation
      this.navigateToQuizCreation();
    } catch (error) {
      this.handleError(error, 'navigateToHost');
    }
  }
  
  navigateToParticipant() {
    try {
      this.clearError();
      // Navigate to participant join flow
      this.router.navigate(['/participant']).catch(error => {
        this.handleError(error, 'navigation to participant page');
      });
    } catch (error) {
      this.handleError(error, 'navigateToParticipant');
    }
  }
  
  showAccessAlert(type: 'admin' | 'survey' | 'poll') {
    this.showHostOptions = false;
    
    // Handle survey navigation directly
    if (type === 'survey') {
      this.navigateToSurveyCreation();
      return;
    }
    
    // Handle poll navigation directly
    if (type === 'poll') {
      this.navigateToPollCreation();
      return;
    }
    
    // Only handle admin type now since survey and poll are handled above
    if (type === 'admin') {
      const config = {
        title: '🔒 Administrator Access',
        message: 'Administrative features are currently under development.\n\nThis section will include:\n• User management\n• System settings\n• Analytics dashboard\n• Security controls\n\nComing soon!'
      };
      
      this.snackBar.open(`${config.title}\n\n${config.message}`, 'Close', {
        duration: 12000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }
  }
  
  navigateToAdmin() {
    // Legacy method
    this.showAccessAlert('admin');
  }
  
  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  }
}
