
import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SettingsService } from '../../Service/settings.service';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent {
  private readonly settings = inject(SettingsService);

  // Keeping the signal from your service
  profanityEnabled = computed(() => this.settings.profanityFilterEnabled());

  onToggleProfanity(enabled: boolean): void {
    this.settings.setProfanityFilter(enabled);
  }
}
