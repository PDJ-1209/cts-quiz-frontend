import { Routes } from '@angular/router';
import { CountdownComponent } from './feature/countdown/countdown.component';
import { QuizPageComponent } from './feature/quiz/quiz.component';
import { QuizUsernameComponent } from './feature/quiz-username/quiz-username.component';
import { ParticipantPageComponent } from './feature/participantpage/participantpage.component';
import { QuizTabsComponent } from './feature/quiz-tabs/quiz-tabs.component';
import { LandingPageComponent } from './feature/landing-page/landing-page.component';

export const routes: Routes = [
  { path: '', component: LandingPageComponent, pathMatch: 'full' },
  { path: 'host/addquestion', component: QuizTabsComponent },
  { path: 'participant', component: ParticipantPageComponent },
  { path: 'countdown', component: CountdownComponent },
  { path: 'quiz', component: QuizPageComponent },
  { path: 'lobby', component: QuizUsernameComponent },
  { path: '**', redirectTo: '' },
];

