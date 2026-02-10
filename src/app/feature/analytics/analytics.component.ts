import { Component, OnInit, AfterViewInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
 
Chart.register(...registerables);
 
@Component({
  selector: 'app-analytics',
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit, AfterViewInit {
  title = 'Quiz Feedback Analytics';
 
  stats = [
    { title: 'Total Quiz Feedbacks', value: '1,247', change: '+18.2%', trend: 'up' },
    { title: 'Average Quiz Rating', value: '4.2/5', change: '+0.3', trend: 'up' },
    { title: 'Top Quiz Sentiment', value: 'Positive', change: '78%', trend: 'up' }
  ];
 
  quizzes = [
    { id: 1, name: 'JavaScript Basics', sections: [45, 62, 38, 55, 48], emojis: [45, 30, 15, 7, 3] },
    { id: 2, name: 'Angular Fundamentals', sections: [52, 48, 65, 42, 58], emojis: [50, 25, 18, 5, 2] },
    { id: 3, name: 'TypeScript Advanced', sections: [38, 55, 42, 48, 52], emojis: [40, 35, 15, 8, 2] },
    { id: 4, name: 'Web Development', sections: [60, 45, 50, 55, 45], emojis: [48, 28, 14, 7, 3] }
  ];
 
  selectedQuiz: number = 1;
 
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}
 
  ngOnInit() {}
 
  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.createQuizSectionsChart();
        this.createEmojiDistributionChart();
      }, 100);
    }
  }
 
  onQuizChange() {
    if (isPlatformBrowser(this.platformId)) {
      this.selectedQuiz = Number(this.selectedQuiz);
      this.createQuizSectionsChart();
      this.createEmojiDistributionChart();
    }
  }
 
  createQuizSectionsChart() {
    if (!isPlatformBrowser(this.platformId)) return;
   
    const canvas = document.getElementById('quizSectionsChart') as HTMLCanvasElement;
    if (!canvas) return;
 
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
 

    // for removing existing chart instance before creating a new one
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }
 
    const selectedQuizData = this.quizzes.find(q => q.id === this.selectedQuiz);
    const sectionData = selectedQuizData ? selectedQuizData.sections : [45, 62, 38, 55, 48];
 
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Section 5'],
        datasets: [{
          label: 'Feedback Count',
          data: sectionData,
          backgroundColor: [
            '#4F46E5',
            '#10B981',
            '#F59E0B',
            '#EF4444',
            '#8B5CF6'
          ],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 10 }
          }
        }
      }
    });
  }
 
  createEmojiDistributionChart() {
    if (!isPlatformBrowser(this.platformId)) return;
   
    const canvas = document.getElementById('emojiChart') as HTMLCanvasElement;
    if (!canvas) return;
 
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
 
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
      existingChart.destroy();
    }
 
    const selectedQuizData = this.quizzes.find(q => q.id === this.selectedQuiz);
    const emojiData = selectedQuizData ? selectedQuizData.emojis : [45, 30, 15, 7, 3];
 
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['😊 Very Happy', '🙂 Happy', '😐 Neutral', '😕 Sad', '😢 Very Sad'],
        datasets: [{
          data: emojiData,
          backgroundColor: [
            '#10B981',
            '#6EE7B7',
            '#FCD34D',
            '#FCA5A5',
            '#EF4444'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 15,
              font: { size: 13 }
            }
          }
        }
      }
    });
  }
}
 
 