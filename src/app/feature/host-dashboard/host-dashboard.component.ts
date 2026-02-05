import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AddQuestionService } from '../../services/add-question.service';
import { DashboardStatsService } from '../../services/dashboard-stats.service';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { QuizListItem } from '../../models/quiz.models';

interface DashboardStats {
  totalQuizzes: number;
  draftQuizzes: number;
  publishedQuizzes: number;
  totalSurveys: number;
  totalPolls: number;
  totalQuestions: number;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  params?: any;
  color: string;
  gradient: string;
}

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './host-dashboard.component.html',
  styleUrl: './host-dashboard.component.css'
})
export class HostDashboardComponent implements OnInit {
  private router = inject(Router);
  private quizService = inject(AddQuestionService);
  private quizCreationService = inject(QuizCreationService);
  private dashboardStatsService = inject(DashboardStatsService);

  // Use shared stats service
  stats = this.dashboardStatsService.stats;

  loading = signal(false);
  welcomeMessage = signal('');
  hostQuizzes = signal<QuizListItem[]>([]);
  currentHostId = '2463579';
  currentDateTime = signal('Loading...');
  hostName = 'Prasannajeet Devendra Jain';
  currentDay = signal('Today');

  quickActions: QuickAction[] = [
    {
      id: 'create-quiz',
      title: 'Create Quiz',
      description: 'Build interactive assessments with multiple question types',
      icon: 'fas fa-brain',
      route: '/host/create-question',
      color: '#0066CC',
      gradient: 'linear-gradient(135deg, #0066CC 0%, #004999 100%)'
    },
    {
      id: 'create-survey',
      title: 'Create Survey',
      description: 'Gather feedback and insights from your audience',
      icon: 'fas fa-clipboard-list',
      route: '/host/create-survey',
      color: '#28A745',
      gradient: 'linear-gradient(135deg, #28A745 0%, #1E7E34 100%)'
    },
    {
      id: 'create-poll',
      title: 'Create Poll',
      description: 'Quick polling for real-time audience engagement',
      icon: 'fas fa-poll',
      route: '/host/create-poll',
      color: '#FD7E14',
      gradient: 'linear-gradient(135deg, #FD7E14 0%, #DC6502 100%)'
    },
    {
      id: 'preview',
      title: 'Preview Content',
      description: 'Preview and test your quizzes before publishing',
      icon: 'fas fa-eye',
      route: '/host/preview',
      color: '#17A2B8',
      gradient: 'linear-gradient(135deg, #17A2B8 0%, #138496 100%)'
    },
    {
      id: 'manage-content',
      title: 'Manage Content',
      description: 'Edit, organize and configure your learning materials',
      icon: 'fas fa-cogs',
      route: '/host/manage-content',
      color: '#6F42C1',
      gradient: 'linear-gradient(135deg, #6F42C1 0%, #5A32A3 100%)'
    }
  ];

  ngOnInit(): void {
    this.updateDateTime(); // Initialize immediately
    this.loadDashboardData();
    this.setWelcomeMessage();
    // Update time every minute
    setInterval(() => this.updateDateTime(), 60000);
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    this.loadQuizzes();
  }

  async loadQuizzes() {
    try {
      this.loading.set(true);
      const quizzes = await this.quizCreationService.getHostQuizzes(this.currentHostId);
      this.hostQuizzes.set(quizzes);
      
      // Update shared dashboard stats with real data
      const draftQuizzes = quizzes.filter(q => q.status === 'DRAFT' || q.status === 'draft').length;
      const publishedQuizzes = quizzes.filter(q => q.status === 'LIVE' || q.status === 'published').length;
      const totalQuestions = quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0);

      this.dashboardStatsService.updateQuizStats(
        quizzes.length,
        draftQuizzes,
        publishedQuizzes,
        totalQuestions
      );
      
    } catch (error) {
      console.error('Failed to load quizzes:', error);
      // Fallback to questions from AddQuestionService
      const totalQuestions = this.quizService.questions().length;
      const totalQuizzes = totalQuestions > 0 ? 1 : 0;
      
      this.dashboardStatsService.updateQuizStats(
        totalQuizzes,
        totalQuizzes, // Assuming all are drafts for now
        0, // No published quizzes yet
        totalQuestions
      );
    } finally {
      this.loading.set(false);
    }
  }

  private setWelcomeMessage(): void {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    
    if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
    } else if (hour >= 17) {
      greeting = 'Good evening';
    }
    
    this.welcomeMessage.set(`${greeting}, Host! Ready to create something amazing?`);
  }

  private updateDateTime(): void {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    const dayOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long'
    };
    
    this.currentDateTime.set(now.toLocaleString('en-US', options));
    this.currentDay.set(now.toLocaleDateString('en-US', dayOptions));
  }

  navigateToAction(action: QuickAction): void {
    if (action.params) {
      this.router.navigate([action.route], { queryParams: action.params });
    } else {
      this.router.navigate([action.route]);
    }
  }
  navigateBack(): void {
    this.router.navigate(['/']);
  }
}