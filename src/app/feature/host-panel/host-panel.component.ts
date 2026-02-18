import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { HostControlService } from '../../services/host-control.service';
import { VisibilityMode, HostSettings } from '../../models/host-settings.model';

/**
 * HostPanelComponent
 * 
 * Control panel for host to manage leaderboard visibility and game state
 */
@Component({
  selector: 'app-host-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './host-panel.component.html',
  styleUrls: ['./host-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HostPanelComponent {
  readonly settings$: Observable<HostSettings>;

  constructor(private hostControl: HostControlService) {
    this.settings$ = this.hostControl.settings$;
  }

  setVisibility(mode: VisibilityMode): void {
    this.hostControl.setVisibilityMode(mode);
  }

  endGame(): void {
    this.hostControl.endGame();
  }

  startNewGame(): void {
    this.hostControl.startNewGame();
  }
}
