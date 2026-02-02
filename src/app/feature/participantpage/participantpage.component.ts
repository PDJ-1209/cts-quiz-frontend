import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-participant-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './participantpage.component.html',
  styleUrls: ['./participantpage.component.css']
})
export class ParticipantPageComponent implements OnInit {
  code = '';

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const paramCode = params.get('code');
      const quizNumber = params.get('quizNumber');
      // Prefer explicit code, else fall back to quizNumber
      const incoming = paramCode ?? quizNumber;
      if (incoming) {
        this.code = incoming;
      }
    });
  }

  onJoin(event: Event) {
    event.preventDefault();
    const trimmed = this.code.trim();
    if (!trimmed) return;
    // Navigate to lobby with the invite code so the user can enter their name
    this.router.navigate(['/lobby'], { queryParams: { code: trimmed } });
  }
}
