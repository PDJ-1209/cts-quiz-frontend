import { trigger, state, style, transition, animate, keyframes, query, stagger, AnimationTriggerMetadata } from '@angular/animations';

/**
 * Leaderboard Animations
 * 
 * Rich animation triggers for:
 * - Row highlights (rank up/down)
 * - Badge animations (pop, bounce)
 * - Delta labels (fade in/out)
 * - Cinematic reveal
 * - Score count-up shimmer
 */

export const leaderboardAnimations: AnimationTriggerMetadata[] = [
  // Row highlight pulse animation
  trigger('rowHighlight', [
    state('rank-up', style({ backgroundColor: 'rgba(0, 255, 136, 0.2)' })),
    state('rank-down', style({ backgroundColor: 'rgba(255, 77, 77, 0.2)' })),
    state('champion', style({ backgroundColor: 'rgba(255, 215, 0, 0.3)' })),
    state('top3-enter', style({ backgroundColor: 'rgba(100, 200, 255, 0.25)' })),
    state('none', style({ backgroundColor: 'transparent' })),
    
    transition('none => rank-up', [
      style({ backgroundColor: 'rgba(0, 255, 136, 0.4)' }),
      animate('400ms ease-out', style({ backgroundColor: 'rgba(0, 255, 136, 0.2)' })),
      animate('1600ms ease-out', style({ backgroundColor: 'transparent' }))
    ]),
    
    transition('none => rank-down', [
      style({ backgroundColor: 'rgba(255, 77, 77, 0.4)' }),
      animate('400ms ease-out', style({ backgroundColor: 'rgba(255, 77, 77, 0.2)' })),
      animate('1600ms ease-out', style({ backgroundColor: 'transparent' }))
    ]),
    
    transition('none => champion', [
      animate('300ms ease-out', keyframes([
        style({ backgroundColor: 'rgba(255, 215, 0, 0)', offset: 0 }),
        style({ backgroundColor: 'rgba(255, 215, 0, 0.5)', offset: 0.5 }),
        style({ backgroundColor: 'rgba(255, 215, 0, 0.3)', offset: 1 })
      ])),
      animate('2000ms ease-out', style({ backgroundColor: 'transparent' }))
    ]),
    
    transition('none => top3-enter', [
      animate('300ms ease-out', keyframes([
        style({ backgroundColor: 'rgba(100, 200, 255, 0)', offset: 0 }),
        style({ backgroundColor: 'rgba(100, 200, 255, 0.4)', offset: 0.5 }),
        style({ backgroundColor: 'rgba(100, 200, 255, 0.25)', offset: 1 })
      ])),
      animate('1700ms ease-out', style({ backgroundColor: 'transparent' }))
    ]),
  ]),

  // Badge pop animation
  trigger('badgePop', [
    transition(':enter', [
      style({ transform: 'scale(0)', opacity: 0 }),
      animate('200ms cubic-bezier(0.68, -0.55, 0.265, 1.55)', 
        style({ transform: 'scale(1)', opacity: 1 }))
    ]),
    transition(':leave', [
      animate('150ms ease-in', 
        style({ transform: 'scale(0)', opacity: 0 }))
    ])
  ]),

  // Delta label fade
  trigger('deltaLabel', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(-10px) scale(0.8)' }),
      animate('200ms ease-out', 
        style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
    ]),
    transition(':leave', [
      animate('300ms 1700ms ease-in', 
        style({ opacity: 0, transform: 'translateY(-15px)' }))
    ])
  ]),

  // Rank badge bounce
  trigger('rankBadge', [
    transition('* => *', [
      animate('400ms cubic-bezier(0.68, -0.55, 0.265, 1.55)', keyframes([
        style({ transform: 'scale(1)', offset: 0 }),
        style({ transform: 'scale(1.3)', offset: 0.4 }),
        style({ transform: 'scale(0.9)', offset: 0.6 }),
        style({ transform: 'scale(1.1)', offset: 0.8 }),
        style({ transform: 'scale(1)', offset: 1 })
      ]))
    ])
  ]),

  // Cinematic reveal (staggered entrance)
  trigger('cinematicReveal', [
    transition(':enter', [
      style({ opacity: 0, transform: 'translateY(30px) scale(0.95)' }),
      animate('500ms {{ delay }}ms cubic-bezier(0.4, 0.0, 0.2, 1)', 
        style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
    ], { params: { delay: 0 } })
  ]),

  // Score shimmer on change
  trigger('scoreChange', [
    transition('* => *', [
      animate('300ms ease-out', keyframes([
        style({ transform: 'scale(1)', color: 'inherit', offset: 0 }),
        style({ transform: 'scale(1.15)', color: '#4ECDC4', offset: 0.5 }),
        style({ transform: 'scale(1)', color: 'inherit', offset: 1 })
      ]))
    ])
  ]),

  // Leaderboard container fade
  trigger('containerFade', [
    state('hidden', style({ opacity: 0, transform: 'scale(0.98)' })),
    state('visible', style({ opacity: 1, transform: 'scale(1)' })),
    transition('hidden => visible', [
      animate('400ms ease-out')
    ]),
    transition('visible => hidden', [
      animate('300ms ease-in')
    ])
  ]),

  // Placeholder pulse
  trigger('placeholderPulse', [
    transition(':enter', [
      animate('1.5s ease-in-out', keyframes([
        style({ opacity: 0.4, offset: 0 }),
        style({ opacity: 0.7, offset: 0.5 }),
        style({ opacity: 0.4, offset: 1 })
      ]))
    ])
  ])
];
