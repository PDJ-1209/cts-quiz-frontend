import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ParticipantResult {
  participantName: string;
  employeeId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  completedAt: Date;
  timeTaken: string;
}

interface QuestionAnalysis {
  questionId: number;
  questionText: string;
  correctCount: number;
  incorrectCount: number;
  totalResponses: number;
  correctPercentage: number;
}

interface SessionSummary {
  sessionCode: string;
  quizName: string;
  totalParticipants: number;
  averageScore: number;
  completionRate: number;
  topScore: number;
  lowestScore: number;
  startedAt: Date;
  endedAt: Date;
}

@Component({
  selector: 'app-results-analysis',
  templateUrl: './results-analysis.component.html',
  styleUrls: ['./results-analysis.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ResultsAnalysisComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  
  private readonly apiBase = `${environment.apiUrl}/Host/QuizSession`;
  
  // Component state
  sessionCode = signal<string>('');
  loading = signal<boolean>(true);
  sessionSummary = signal<SessionSummary | null>(null);
  participantResults = signal<ParticipantResult[]>([]);
  questionAnalysis = signal<QuestionAnalysis[]>([]);
  
  // Computed properties
  hasData = computed(() => this.participantResults().length > 0);
  
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const code = params['sessionCode'];
      if (code) {
        this.sessionCode.set(code);
        this.loadResults();
      } else {
        this.snackBar.open('⚠️ No session code provided', 'Close', { duration: 4000 });
        this.router.navigate(['/host/manage-content']);
      }
    });
  }

  /**
   * Load results and analytics from backend
   */
  private async loadResults() {
    try {
      this.loading.set(true);
      
      // Fetch session summary
      const summaryUrl = `${this.apiBase}/${this.sessionCode()}/summary`;
      const summary = await firstValueFrom(this.http.get<SessionSummary>(summaryUrl));
      this.sessionSummary.set(summary);
      
      // Fetch participant results
      const resultsUrl = `${this.apiBase}/${this.sessionCode()}/results`;
      const results = await firstValueFrom(this.http.get<ParticipantResult[]>(resultsUrl));
      this.participantResults.set(results);
      
      // Fetch question-wise analysis
      const analysisUrl = `${this.apiBase}/${this.sessionCode()}/question-analysis`;
      const analysis = await firstValueFrom(this.http.get<QuestionAnalysis[]>(analysisUrl));
      this.questionAnalysis.set(analysis);
      
      this.loading.set(false);
      console.log('[ResultsAnalysis] Data loaded successfully');
    } catch (error: any) {
      console.error('[ResultsAnalysis] Failed to load results:', error);
      this.loading.set(false);
      this.snackBar.open('⚠️ Failed to load quiz results', 'Close', { duration: 4000 });
    }
  }

  /**
   * Navigate back to content management
   */
  goBack() {
    this.router.navigate(['/host/manage-content']);
  }

  /**
   * Export results as CSV
   */
  exportAsCSV() {
    const results = this.participantResults();
    if (results.length === 0) {
      this.snackBar.open('⚠️ No results to export', 'Close', { duration: 3000 });
      return;
    }

    // Generate CSV content
    const headers = ['Participant Name', 'Employee ID', 'Score', 'Correct Answers', 'Total Questions', 'Completed At', 'Time Taken'];
    const rows = results.map(r => [
      r.participantName,
      r.employeeId,
      r.score.toString(),
      r.correctAnswers.toString(),
      r.totalQuestions.toString(),
      new Date(r.completedAt).toLocaleString(),
      r.timeTaken
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `quiz_results_${this.sessionCode()}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackBar.open('✅ Results exported successfully', 'Close', { duration: 3000 });
  }

  /**
   * Get bar width percentage for question analysis chart
   */
  getBarWidth(count: number, total: number): number {
    return total > 0 ? (count / total) * 100 : 0;
  }
}
