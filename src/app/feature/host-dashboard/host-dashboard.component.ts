import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AddQuestionService } from '../../services/add-question.service';

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

  // Signals for reactive data
  stats = signal<DashboardStats>({
    totalQuizzes: 0,
    draftQuizzes: 0,
    publishedQuizzes: 0,
    totalSurveys: 0,
    totalPolls: 0,
    totalQuestions: 0
  });

  loading = signal(false);
  welcomeMessage = signal('');

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
    this.loadDashboardData();
    this.setWelcomeMessage();
  }

  private loadDashboardData(): void {
    this.loading.set(true);
    
    // Simulate loading dashboard statistics
    setTimeout(() => {
      // Get actual data from services when available
      const currentStats: DashboardStats = {
        totalQuizzes: this.quizService.questions().length > 0 ? 1 : 0,
        draftQuizzes: 0,
        publishedQuizzes: 0,
        totalSurveys: 0,
        totalPolls: 0,
        totalQuestions: this.quizService.questions().length
      };
      
      this.stats.set(currentStats);
      this.loading.set(false);
    }, 500);
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

  refreshStats(): void {
    this.loadDashboardData();
  }
}