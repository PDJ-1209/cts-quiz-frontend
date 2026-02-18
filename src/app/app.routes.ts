import { Routes } from '@angular/router';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/landing', pathMatch: 'full' },
  
  // Auth Routes - Keep these loaded immediately for fast access
  { 
    path: 'login', 
    redirectTo: '/landing',
    pathMatch: 'full'
  },
  { 
    path: 'landing', 
    loadComponent: () => import('./feature/landing-page/landing-page.component').then(c => c.LandingPageComponent)
  },
  
  // Admin Routes - Lazy loaded (Role ID: 1)
  { 
    path: 'admin/dashboard', 
    loadComponent: () => import('./feature/admin-dashboard/admin-dashboard.component').then(c => c.AdminDashboardComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  
  // Host Routes - Lazy loaded (Role ID: 2)
  { 
    path: 'host/dashboard', 
    loadComponent: () => import('./feature/host-dashboard/host-dashboard.component').then(c => c.HostDashboardComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/addquestion', 
    loadComponent: () => import('./feature/quiz-tabs/quiz-tabs.component').then(c => c.QuizTabsComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-question', 
    loadComponent: () => import('./feature/add-question/add-question.component').then(c => c.AddQuestionComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-survey', 
    loadComponent: () => import('./feature/create-survey/create-survey.component').then(c => c.CreateSurveyComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-poll', 
    loadComponent: () => import('./feature/create-poll/create-poll.component').then(c => c.CreatePollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/preview', 
    loadComponent: () => import('./feature/preview/preview.component').then(c => c.PreviewComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/manage-content', 
    loadComponent: () => import('./feature/result/result.component').then(c => c.ResultComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/leaderboard', 
    loadComponent: () => import('./feature/leaderboard/leaderboard.component').then(c => c.LeaderboardComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'host/create-quiz', 
    redirectTo: '/host/create-question',
    pathMatch: 'full'
  },
  
  // User/Participant Routes - Lazy loaded (Role ID: 3)
  { 
    path: 'user/dashboard', 
    loadComponent: () => import('./feature/participantpage/participantpage.component').then(c => c.ParticipantPageComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'template', 
    loadComponent: () => import('./feature/template/template.component').then(c => c.TemplateComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host', 'Admin'], roleIds: [1, 2] }
  },
  { 
    path: 'host/polls', 
    loadComponent: () => import('./feature/create-poll/create-poll.component').then(c => c.CreatePollComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'participant', 
    loadComponent: () => import('./feature/participantpage/participantpage.component').then(c => c.ParticipantPageComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'countdown', 
    loadComponent: () => import('./feature/countdown/countdown.component').then(c => c.CountdownComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'quiz', 
    loadComponent: () => import('./feature/quiz/quiz.component').then(c => c.QuizPageComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'lobby', 
    loadComponent: () => import('./feature/quiz-username/quiz-username.component').then(c => c.QuizUsernameComponent),
    canActivate: [roleGuard],
    data: { roles: ['User'], roleIds: [3] }
  },
  { 
    path: 'feedback', 
    loadComponent: () => import('./feature/feedback/feedback.component').then(c => c.FeedbackFormComponent)
    // No guard needed - allow anyone who completed a quiz to give feedback
  },
  { 
    path: 'host/calendar', 
    loadComponent: () => import('./feature/quiz-calendar/quiz-calendar.component').then(c => c.QuizCalendarComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'admin/calendar', 
    loadComponent: () => import('./feature/quiz-calendar/quiz-calendar.component').then(c => c.QuizCalendarComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  { 
    path: 'host/analytics', 
    loadComponent: () => import('./feature/analytics/analytics.component').then(c => c.AnalyticsComponent),
    canActivate: [roleGuard],
    data: { roles: ['Host'], roleIds: [2] }
  },
  { 
    path: 'admin/analytics', 
    loadComponent: () => import('./feature/analytics/analytics.component').then(c => c.AnalyticsComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  { 
    path: 'admin/user-management', 
    loadComponent: () => import('./feature/user-management/user-management.component').then(c => c.UserManagementComponent),
    canActivate: [roleGuard],
    data: { roles: ['Admin'], roleIds: [1] }
  },
  
  // Catch all
  { path: '**', redirectTo: '' },
];