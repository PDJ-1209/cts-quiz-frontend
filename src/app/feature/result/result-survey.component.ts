import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { ParticipantSurveyService } from '../../services/participant-survey.service';
import { SurveyResultDto } from '../../models/survey/submit-survey-answer.dto';

@Component({
  selector: 'app-result-survey',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatCardModule, MatProgressBarModule, MatIconModule, MatSnackBarModule],
  templateUrl: './result-survey.component.html',
  styleUrls: ['./result-survey.component.css']
})
export class ResultSurveyComponent implements OnInit {
  surveyResults: SurveyResultDto[] = [];
  isLoading = true;
  sessionId: number = 0;
  sessionCode: string = '';
  displayedColumns: string[] = ['participantName', 'completionPercentage', 'completedAt', 'actions'];

  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private surveyService = inject(ParticipantSurveyService);

  ngOnInit(): void {
    const sessionIdStr = localStorage.getItem('sessionId');
    const sessionCodeStr = localStorage.getItem('sessionCode');
    
    if (sessionIdStr) {
      this.sessionId = parseInt(sessionIdStr);
      this.sessionCode = sessionCodeStr || '';
      this.loadSurveyResults();
    }
  }

  loadSurveyResults(): void {
    this.isLoading = true;
    this.surveyService.getSurveyResults(this.sessionId).subscribe({
      next: (results) => {
        this.surveyResults = results;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading survey results:', err);
        this.snackBar.open('Failed to load survey results', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  viewParticipantResponse(participant: SurveyResultDto): void {
    // Navigate to participant response details
    this.router.navigate(['/survey-response-details'], {
      queryParams: {
        participantId: participant.participantId,
        sessionId: this.sessionId
      }
    });
  }

  downloadResults(): void {
    const csv = this.generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-results-${this.sessionCode}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open('Survey results downloaded', 'Close', { duration: 2000 });
  }

  private generateCSV(): string {
    let csv = 'Participant Name,Completion %,Completed At\n';
    this.surveyResults.forEach(result => {
      csv += `"${result.participantName}",${result.completionPercentage},${result.completedAt}\n`;
    });
    return csv;
  }

  goBack(): void {
    this.router.navigate(['/result']);
  }
}
