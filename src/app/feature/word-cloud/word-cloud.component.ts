import { Component, OnInit, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SurveyService } from '../../services/survey.service';
import { WordCloudResponse, WordCloudItem } from '../../models/isurvey';

@Component({
  selector: 'app-word-cloud',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  template: `
    <div class="word-cloud-container">
      <div class="word-cloud-header">
        <h2>📊 Survey Word Cloud</h2>
        <p class="subtitle">Text responses visualization</p>
      </div>

      <div class="stats-bar" *ngIf="wordCloudData()">
        <div class="stat">
          <span class="stat-value">{{ wordCloudData()?.totalResponses || 0 }}</span>
          <span class="stat-label">Responses</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ wordCloudData()?.uniqueWords || 0 }}</span>
          <span class="stat-label">Unique Words</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ generatedTime }}</span>
          <span class="stat-label">Generated</span>
        </div>
      </div>

      <div class="canvas-container">
        <canvas #wordCloudCanvas></canvas>
      </div>

      <div class="action-buttons">
        <button class="btn btn-primary" (click)="refreshWordCloud()">
          🔄 Refresh
        </button>
        <button class="btn btn-success" (click)="exportAsPNG()">
          📥 Export PNG
        </button>
        <button class="btn btn-info" (click)="exportAsJSON()">
          📄 Export JSON
        </button>
      </div>

      <div class="word-list" *ngIf="wordCloudData()">
        <h3>Top Words</h3>
        <div class="word-items">
          <div class="word-item" *ngFor="let word of getTopWords(20)">
            <span class="word-text">{{ word.word }}</span>
            <span class="word-count">{{ word.frequency }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .word-cloud-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .word-cloud-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .word-cloud-header h2 {
      margin: 0;
      color: #333;
      font-size: 32px;
    }

    .subtitle {
      color: #666;
      font-size: 16px;
      margin-top: 5px;
    }

    .stats-bar {
      display: flex;
      justify-content: space-around;
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      display: block;
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
    }

    .stat-label {
      display: block;
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }

    .canvas-container {
      background: white;
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 30px;
      min-height: 500px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    canvas {
      max-width: 100%;
      height: auto;
    }

    .action-buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-bottom: 30px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-success {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      color: white;
    }

    .btn-info {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      color: white;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }

    .word-list {
      background: white;
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .word-list h3 {
      margin-top: 0;
      color: #333;
      font-size: 24px;
      margin-bottom: 20px;
    }

    .word-items {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }

    .word-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      background: #f8f9fa;
      border-radius: 8px;
      transition: all 0.3s;
    }

    .word-item:hover {
      background: #e9ecef;
      transform: translateX(5px);
    }

    .word-text {
      font-weight: 600;
      color: #333;
    }

    .word-count {
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: bold;
    }

    @media (max-width: 768px) {
      .stats-bar {
        flex-direction: column;
        gap: 15px;
      }

      .action-buttons {
        flex-direction: column;
      }

      .word-items {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class WordCloudComponent implements OnInit {
  @ViewChild('wordCloudCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private route = inject(ActivatedRoute);
  private surveyService = inject(SurveyService);
  private snackBar = inject(MatSnackBar);

  surveyId: number = 0;
  sessionId: number = 0;
  wordCloudData = signal<WordCloudResponse | null>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.surveyId = +params['surveyId'] || 0;
      this.sessionId = +params['sessionId'] || 0;

      if (this.surveyId && this.sessionId) {
        this.loadWordCloud();
      } else {
        this.snackBar.open('⚠️ Missing survey or session ID', 'Close', { duration: 3000 });
      }
    });
  }

  loadWordCloud(): void {
    this.surveyService.getWordCloud(this.surveyId, this.sessionId).subscribe({
      next: (data) => {
        this.wordCloudData.set(data);
        setTimeout(() => this.renderWordCloud(), 100);
      },
      error: (error) => {
        console.error('Failed to load word cloud:', error);
        this.snackBar.open('❌ Failed to load word cloud', 'Close', { duration: 3000 });
      }
    });
  }

  refreshWordCloud(): void {
    this.loadWordCloud();
    this.snackBar.open('🔄 Refreshing word cloud...', 'Close', { duration: 2000 });
  }

  renderWordCloud(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.wordCloudData()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1000;
    canvas.height = 600;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const words = this.wordCloudData()!.words;
    if (words.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No text responses yet', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Simple word cloud layout
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

    words.forEach((word, index) => {
      const fontSize = 16 + Math.floor(word.weight * 48); // 16-64px
      ctx.font = `bold ${fontSize}px Arial`;

      // Color based on weight
      const hue = 240 + (word.weight * 60); // Blue to purple
      const saturation = 70 + (word.weight * 20);
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, 50%)`;

      // Spiral layout
      const angle = index * 0.5;
      const radius = (index / words.length) * maxRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word.word, x, y);
    });
  }

  exportAsPNG(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `wordcloud-survey-${this.surveyId}-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.snackBar.open('✅ Word cloud exported as PNG', 'Close', { duration: 3000 });
      }
    });
  }

  exportAsJSON(): void {
    const data = this.wordCloudData();
    if (!data) return;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `wordcloud-data-survey-${this.surveyId}-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    this.snackBar.open('✅ Word cloud data exported as JSON', 'Close', { duration: 3000 });
  }

  get generatedTime(): string {
    const data = this.wordCloudData();
    if (!data) return 'N/A';
    return new Date(data.generatedAt).toLocaleTimeString();
  }

  getTopWords(count: number): WordCloudItem[] {
    return this.wordCloudData()?.words.slice(0, count) || [];
  }
}
