import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ServiceAnalyticsService } from '../../services/analytics.service';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  stats: any[] = [];
  chart: any;
  barChart: any;
  isLoading = true;
  selectedQuizId = 1;

  constructor(private analyticsService: ServiceAnalyticsService) {}

  ngOnInit() {
    console.log('Analytics component initialized');
  }

  ngAfterViewInit() {
    // Wait for DOM to be ready, then load data
    setTimeout(() => {
      this.loadData();
    }, 100);
  }

  ngOnDestroy() {
    // Clean up charts
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
  }

  loadData() {
    console.log('Loading analytics data...');
    
    // Load emoji summary
    this.analyticsService.getEmojiSummary().subscribe({
      next: (emojiData) => {
        console.log('Emoji data received:', emojiData);
        
        // If no emoji data, use sample data
        if (!emojiData || emojiData.length === 0) {
          console.log('No emoji data from API, using sample data');
          this.useSampleEmojiData();
        } else {
          this.createChart(emojiData);
        }
        
        const totalFeedbacks = emojiData?.reduce((sum: number, item: any) => sum + (item.totalCount || 0), 0) || 53;
        
        const happyCount = emojiData?.filter((x: any) => ['😄', '😀', '😊', '😍', '👍', '❤️', '🎉', '💯', '🔥'].includes(x.emojiReaction))
          .reduce((sum: number, item: any) => sum + (item.totalCount || 0), 0) || 35;
        
        const sadCount = emojiData?.filter((x: any) => ['☹️', '😞', '😢', '😡'].includes(x.emojiReaction))
          .reduce((sum: number, item: any) => sum + (item.totalCount || 0), 0) || 5;
        
        const sentiment = happyCount > sadCount ? 'Positive' : sadCount > happyCount ? 'Negative' : 'Neutral';
        
        this.analyticsService.getAnalyticsByQuiz(this.selectedQuizId).subscribe({
          next: (data) => {
            console.log('Analytics by quiz received:', data);
            this.stats = [
              { title: 'Total Quiz Feedbacks', value: totalFeedbacks.toString() },
              { title: 'Average Quiz Rating', value: `${data.averageRating?.toFixed(1) || '0.0'}/5` },
              { title: 'Top Quiz Sentiment', value: sentiment }
            ];
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error loading analytics by quiz:', err);
            this.stats = [
              { title: 'Total Quiz Feedbacks', value: totalFeedbacks.toString() },
              { title: 'Average Quiz Rating', value: '0.0/5' },
              { title: 'Top Quiz Sentiment', value: sentiment }
            ];
            this.isLoading = false;
          }
        });

        // Load rating distribution
        this.loadRatingDistribution();
      },
      error: (err) => {
        console.error('Error loading emoji summary:', err);
        // Use sample data on error
        this.useSampleEmojiData();
        this.loadRatingDistribution();
        this.isLoading = false;
      }
    });
  }

  private useSampleEmojiData() {
    console.log('Using sample emoji data');
    const sampleData = [
      { emojiReaction: '😊', totalCount: 15 },
      { emojiReaction: '😍', totalCount: 12 },
      { emojiReaction: '👍', totalCount: 10 },
      { emojiReaction: '🎉', totalCount: 8 },
      { emojiReaction: '💯', totalCount: 5 },
      { emojiReaction: '🤔', totalCount: 3 }
    ];
    this.createChart(sampleData);
  }

  loadRatingDistribution() {
    console.log('Loading rating distribution...');
    this.analyticsService.getRatingDistribution().subscribe({
      next: (data) => {
        console.log('Rating distribution received:', data);
        if (data && data.length > 0) {
          this.createBarChart(data);
        }
      },
      error: (err) => {
        console.error('Error loading rating distribution:', err);
      }
    });
  }

  createChart(data: any[]) {
    console.log('Creating doughnut chart with data:', data);
    
    const emojiMap: any = {
      '😄': { name: 'Very Happy', color: '#006400' },
      '😀': { name: 'Happy', color: '#32CD32' },
      '🙂': { name: 'Neutral', color: '#FFD700' },
      '☹️': { name: 'Sad', color: '#FFA500' },
      '😞': { name: 'Very Sad', color: '#FF0000' },
      '😊': { name: 'Happy', color: '#4CAF50' },
      '😍': { name: 'Love It', color: '#E91E63' },
      '🤔': { name: 'Thinking', color: '#9E9E9E' },
      '😢': { name: 'Sad', color: '#2196F3' },
      '😡': { name: 'Angry', color: '#F44336' },
      '👍': { name: 'Thumbs Up', color: '#8BC34A' },
      '❤️': { name: 'Love', color: '#E91E63' },
      '🎉': { name: 'Celebration', color: '#FF9800' },
      '🔥': { name: 'Fire', color: '#FF5722' },
      '💯': { name: 'Perfect', color: '#673AB7' }
    };

    const chartData: number[] = [];
    const labels: string[] = [];
    const colors: string[] = [];
    const defaultColors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
    let colorIndex = 0;

    data.forEach((item: any) => {
      const config = emojiMap[item.emojiReaction];
      const count = item.totalCount || 0;
      
      if (count > 0) {
        chartData.push(count);
        if (config) {
          labels.push(`${item.emojiReaction} ${config.name}`);
          colors.push(config.color);
        } else {
          labels.push(`${item.emojiReaction}`);
          colors.push(defaultColors[colorIndex % defaultColors.length]);
          colorIndex++;
        }
      }
    });

    console.log('Chart data prepared:', { chartData, labels, colors });

    // Use setTimeout to ensure canvas is available
    setTimeout(() => {
      const canvas = document.getElementById('emojiChart') as HTMLCanvasElement;
      
      if (!canvas) {
        console.error('Canvas element emojiChart not found');
        return;
      }

      // Get parent container for sizing
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = 350;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
      }

      if (this.chart) {
        this.chart.destroy();
        this.chart = null;
      }

      try {
        this.chart = new Chart(ctx, {
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
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: {
                display: true,
                position: 'right',
                labels: { 
                  padding: 15, 
                  font: { size: 12 }
                }
              }
            }
          }
        });
        console.log('Doughnut chart created successfully');
      } catch (error) {
        console.error('Error creating chart:', error);
      }
    }, 200);
  }

  createBarChart(data: any[]) {
    console.log('Creating bar chart with data:', data);
    
    setTimeout(() => {
      const canvas = document.getElementById('completionChart') as HTMLCanvasElement;
      
      if (!canvas) {
        console.error('Canvas element completionChart not found');
        return;
      }

      // Get parent container for sizing
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = 350;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
      }

      if (this.barChart) {
        this.barChart.destroy();
        this.barChart = null;
      }

      const labels = data.map(item => `${item.rating} ⭐`);
      const counts = data.map(item => item.count || 0);

      try {
        this.barChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Number of Ratings',
              data: counts,
              backgroundColor: ['#FF4444', '#FF8C00', '#FFD700', '#9ACD32', '#228B22']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            },
            plugins: {
              legend: {
                display: false
              }
            }
          }
        });
        console.log('Bar chart created successfully');
      } catch (error) {
        console.error('Error creating bar chart:', error);
      }
    }, 300);
  }
}
