import { Component, Input } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatToolbarModule, MatChipsModule, MatCardModule, MatProgressBarModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Input() current = 0;
  @Input() total = 1;

  get pill(): string {
    return `Question ${this.current + 1} of ${this.total}`;
  }

  get percent(): number {
    if (this.total <= 0) return 0;
    return ((this.current + 1) / this.total) * 100;
  }
}
