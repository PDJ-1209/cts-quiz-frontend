import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MotionEffectsService, GameToast } from '../../services/motion-effects.service';
import { trigger, transition, style, animate } from '@angular/animations';

/**
 * GameToastComponent
 * 
 * Displays celebratory toast notifications for game events
 */
@Component({
  selector: 'app-game-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-toast.component.html',
  styleUrls: ['./game-toast.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toastAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(100%) scale(0.8)' }),
        animate('300ms cubic-bezier(0.4, 0.0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateX(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', 
          style({ opacity: 0, transform: 'translateX(100%) scale(0.8)' }))
      ])
    ])
  ]
})
export class GameToastComponent {
  toasts;

  constructor(private motionEffects: MotionEffectsService) {
    this.toasts = this.motionEffects.toasts;
  }

  getToastClass(type: GameToast['type']): string {
    return `toast-${type}`;
  }

  removeToast(id: string): void {
    this.motionEffects.removeToast(id);
  }
}
