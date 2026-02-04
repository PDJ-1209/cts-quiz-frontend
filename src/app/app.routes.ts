import { Routes } from '@angular/router';
import { CountdownComponent } from './feature/countdown/countdown.component';
import { QuizPageComponent } from './feature/quiz/quiz.component';
import { QuizUsernameComponent } from './feature/quiz-username/quiz-username.component';
import { ParticipantPageComponent } from './feature/participantpage/participantpage.component';
import { QuizTabsComponent } from './feature/quiz-tabs/quiz-tabs.component';
import { LandingPageComponent } from './feature/landing-page/landing-page.component';
import { HostDashboardComponent } from './feature/host-dashboard/host-dashboard.component';
import { TemplateComponent } from './feature/template/template.component';
import { CreatePollComponent } from './feature/create-poll/create-poll.component';
import { AddQuestionComponent } from './feature/add-question/add-question.component';
import { CreateSurveyComponent } from './feature/create-survey/create-survey.component';
import { ResultComponent } from './feature/result/result.component';

export const routes: Routes = [
  { path: '', component: LandingPageComponent, pathMatch: 'full' },
  { path: 'host/dashboard', component: HostDashboardComponent },
  { path: 'host/addquestion', component: QuizTabsComponent },
  { path: 'host/create-question', component: AddQuestionComponent },
  { path: 'host/create-survey', component: CreateSurveyComponent },
  { path: 'host/create-poll', component: CreatePollComponent },
  { path: 'host/manage-content', component: ResultComponent },
  { 
    path: 'host/create-quiz', 
    redirectTo: '/host/create-question',
    pathMatch: 'full'
  },
  { path: 'template', component: TemplateComponent },
  { path: 'host/polls', component: CreatePollComponent },
  { path: 'participant', component: ParticipantPageComponent },
  { path: 'countdown', component: CountdownComponent },
  { path: 'quiz', component: QuizPageComponent },
  { path: 'lobby', component: QuizUsernameComponent },
  { path: '**', redirectTo: '' },
];