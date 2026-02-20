import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { ParticipantPollService } from '../../services/participant-poll.service';
import { PollOverallResultDto, PollResultDto } from '../../models/poll/submit-poll-answer.dto';

@Component({
  selector: 'app-result-poll',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatCardModule, MatProgressBarModule, MatIconModule, MatSnackBarModule],
  templateUrl: './result-poll.component.html',
  styleUrls: ['./result-poll.component.css']
})
export class ResultPollComponent implements OnInit {
  pollResults: PollOverallResultDto | null = null;
  isLoading = true;
  pollId: number = 0;
  sessionCode: string = '';
  displayedColumns: string[] = ['optionText', 'voteCount', 'percentage', 'visualization'];

  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pollService = inject(ParticipantPollService);

  ngOnInit(): void {
    const pollIdStr = localStorage.getItem('currentPollId');
    const sessionCodeStr = localStorage.getItem('sessionCode');
    
    if (pollIdStr) {
      this.pollId = parseInt(pollIdStr);
      this.sessionCode = sessionCodeStr || '';
      this.loadPollResults();
    }
  }

  loadPollResults(): void {
    this.isLoading = true;
    this.pollService.getPollResults(this.pollId).subscribe({
      next: (results) => {
        this.pollResults = results;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading poll results:', err);
        this.snackBar.open('Failed to load poll results', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  getPercentageBarWidth(option: PollResultDto): number {
    if (!this.pollResults || this.pollResults.totalVotes === 0) return 0;
    return (option.voteCount / this.pollResults.totalVotes) * 100;
  }

  downloadResults(): void {
    const csv = this.generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poll-results-${this.sessionCode}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open('Poll results downloaded', 'Close', { duration: 2000 });
  }

  private generateCSV(): string {
    if (!this.pollResults) return '';
    
    let csv = 'Poll Name,Total Votes\n';
    csv += `"${this.pollResults.pollName}",${this.pollResults.totalVotes}\n\n`;
    csv += 'Option,Votes,Percentage\n';
    
    this.pollResults.options.forEach(option => {
      csv += `"${option.optionText}",${option.voteCount},${option.percentage.toFixed(2)}%\n`;
    });
    
    return csv;
  }

  refreshResults(): void {
    this.loadPollResults();
  }

  goBack(): void {
    this.router.navigate(['/result']);
  }
}
