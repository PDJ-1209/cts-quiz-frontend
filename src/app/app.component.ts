import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavigationComponent } from './feature/navigation/navigation.component';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { ResultPollComponent } from './result-poll/result-poll.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavigationComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'CTS_Quiz';
  showNavigation = false;

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showNavigation = event.url.includes('/host/addquestion');
    });
  }
}
