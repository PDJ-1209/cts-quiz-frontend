import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart } from 'chart.js/auto';
import { ServiceAnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-analytics',
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  stats: any[] = [];
  chart: any;
  barChart: any;
  isLoading = true;
  selectedQuizId = 1;

  constructor(private analyticsService: ServiceAnalyticsService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.analyticsService.getEmojiSummary().subscribe({
      next: (emojiData) => {
        const totalFeedbacks = emojiData.reduce((sum: number, item: any) => sum + (item.totalCount || 0), 0);
        
        const happyCount = emojiData.filter((x: any) => ['😄', '😀'].includes(x.emojiReaction))
          .reduce((sum: number, item: any) => sum + (item.totalCount || 0), 0);
        
        const sadCount = emojiData.filter((x: any) => ['☹️', '😞'].includes(x.emojiReaction))
          .reduce((sum: number, item: any) => sum + (item.totalCount || 0), 0);
        
        const sentiment = happyCount > sadCount ? 'Positive' : sadCount > happyCount ? 'Negative' : 'Neutral';
        
        this.analyticsService.getAnalyticsByQuiz(this.selectedQuizId).subscribe({
          next: (data) => {
            this.stats = [
              { title: 'Total Quiz Feedbacks', value: totalFeedbacks.toString() },
              { title: 'Average Quiz Rating', value: `${data.averageRating?.toFixed(1) || '0.0'}/5` },
              { title: 'Top Quiz Sentiment', value: sentiment }
            ];
            this.isLoading = false;
          }
        });

        this.createChart(emojiData);
        this.loadRatingDistribution();
      }
    });
  }

  loadRatingDistribution() {
    this.analyticsService.getRatingDistribution().subscribe({
      next: (data) => {
        this.createBarChart(data);
      }
    });
  }

  createChart(data: any[]) {
    const emojiMap: any = {
      '😄': { name: 'Very Happy', color: '#006400' },
      '😀': { name: 'Happy', color: '#90EE90' },
      '🙂': { name: 'Neutral', color: '#FFD700' },
      '☹️': { name: 'Sad', color: '#FFA500' },
      '😞': { name: 'Very Sad', color: '#FF0000' }
    };

    const chartData: number[] = [];
    const labels: string[] = [];
    const colors: string[] = [];

    data.forEach((item: any) => {
      const config = emojiMap[item.emojiReaction];
      if (config) {
        chartData.push(item.totalCount || 0);
        labels.push(`${item.emojiReaction} ${config.name}`);
        colors.push(config.color);
      }
    });

    setTimeout(() => {
      if (this.chart) this.chart.destroy();
      const canvas = document.getElementById('emojiChart') as HTMLCanvasElement;
      if (!canvas) return;

      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: chartData,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '65%',
          plugins: {
            legend: {
              position: 'right',
              labels: { padding: 15, font: { size: 13 } }
            }
          }
        }
      });
    }, 200);
  }

  createBarChart(data: any[]) {
    setTimeout(() => {
      const canvas = document.getElementById('completionChart') as HTMLCanvasElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (this.barChart) this.barChart.destroy();

      const labels = data.map(item => `${item.rating} ⭐`);
      const counts = data.map(item => item.count || 0);

      this.barChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Ratings',
            data: counts,
            backgroundColor: ['#FF0000', '#FFA500', '#FFD700', '#90EE90', '#006400']
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }, 1000);
  }
}
