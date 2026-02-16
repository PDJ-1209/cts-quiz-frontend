import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { ServiceAnalyticsService, HostDto, HostQuizDto, HostFeedbackAnalyticsDto } from '../../services/analytics.service';
import { FormsModule } from '@angular/forms';
import { DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

// Register all Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-analytics',
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  stats: any[] = [];
  chart: any;
  barChart: any;
  isLoading = true;
  selectedQuizId = 1;

  // Drag and drop properties
  isDragEnabled = false;

  // New properties for host/quiz filtering
  hosts: HostDto[] = [];
  selectedHostId: string = '';
  quizzes: HostQuizDto[] = [];
  selectedFilteredQuizId: number | null = null;
  hostFeedbackAnalytics: HostFeedbackAnalyticsDto | null = null;
  showHostFiltering = false;
  loadingHosts = false;
  loadingQuizzes = false;

  constructor(private analyticsService: ServiceAnalyticsService) {}

  ngOnInit() {
    console.log('Analytics component initialized');
    this.isLoading = true;
    this.loadHosts();
    
    // Refresh hosts periodically to catch newly created hosts
    setInterval(() => {
      this.loadHosts();
    }, 10000); // Refresh every 10 seconds
  }

  ngAfterViewInit() {
    // Charts will be created when data is loaded
    // No longer calling loadData() here - it's called after host selection
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

  /**
   * Load all hosts who have conducted quizzes
   */
  loadHosts() {
    this.loadingHosts = true;
    this.analyticsService.getAllHosts().subscribe({
      next: (hosts) => {
        console.log('Hosts loaded:', hosts);
        this.hosts = hosts.sort((a, b) => a.hostName.localeCompare(b.hostName));
        this.loadingHosts = false;
        
        // If currently selected host is still in the list, keep it
        if (this.selectedHostId && hosts.some(h => h.hostId === this.selectedHostId)) {
          // Keep current selection
        } else if (hosts.length > 0) {
          // Select first host if none selected
          this.selectedHostId = hosts[0].hostId;
          this.onHostSelected();
        }
      },
      error: (err) => {
        console.error('Error loading hosts:', err);
        this.loadingHosts = false;
      }
    });
  }

  /**
   * Called when a host is selected
   */
  onHostSelected() {
    if (!this.selectedHostId) return;
    
    console.log('Loading quizzes for host:', this.selectedHostId);
    this.loadingQuizzes = true;
    this.selectedFilteredQuizId = null;
    this.quizzes = [];
    this.hostFeedbackAnalytics = null;

    this.analyticsService.getQuizzesByHost(this.selectedHostId).subscribe({
      next: (quizzes) => {
        console.log('Quizzes loaded for host:', quizzes);
        this.quizzes = quizzes;
        this.loadingQuizzes = false;
        if (quizzes.length > 0) {
          this.selectedFilteredQuizId = quizzes[0].quizId;
          this.onQuizSelected();
        }
      },
      error: (err) => {
        console.error('Error loading quizzes for host:', err);
        this.loadingQuizzes = false;
      }
    });
  }

  /**
   * Called when a quiz is selected for the host
   */
  onQuizSelected() {
    if (!this.selectedHostId || !this.selectedFilteredQuizId) return;

    console.log(`Loading analytics for host: ${this.selectedHostId}, quiz: ${this.selectedFilteredQuizId}`);
    this.isLoading = true;

    this.analyticsService.getFeedbackAnalyticsByHostAndQuiz(this.selectedHostId, this.selectedFilteredQuizId).subscribe({
      next: (analytics) => {
        console.log('Host-Quiz analytics loaded:', analytics);
        this.hostFeedbackAnalytics = analytics;
        this.updateStatsFromHostAnalytics(analytics);
        this.createChartFromHostAnalytics(analytics);
        this.createBarChartFromHostAnalytics(analytics);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading host-quiz analytics:', err);
        this.isLoading = false;
      }
    });
  }

  /**
   * Update stats card from host analytics
   */
  private updateStatsFromHostAnalytics(analytics: HostFeedbackAnalyticsDto) {
    this.stats = [
      { title: 'Total Responses', value: analytics.totalResponses.toString() },
      { title: 'Average Rating', value: `${analytics.averageRating.toFixed(1)}/5` },
      { title: 'Host', value: analytics.hostName },
      { title: 'Quiz', value: analytics.quizName }
    ];
  }

  /**
   * Create emoji chart from host analytics
   */
  private createChartFromHostAnalytics(analytics: HostFeedbackAnalyticsDto) {
    if (analytics.emojiBreakdown && analytics.emojiBreakdown.length > 0) {
      this.createChart(analytics.emojiBreakdown);
    } else {
      this.useSampleEmojiData();
    }
  }

  /**
   * Create bar chart from host analytics
   */
  private createBarChartFromHostAnalytics(analytics: HostFeedbackAnalyticsDto) {
    if (analytics.ratingDistribution && analytics.ratingDistribution.length > 0) {
      this.createBarChart(analytics.ratingDistribution);
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
      // { emojiReaction: '😊', totalCount: 15 },
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

  /**
   * Toggle host filtering view
   */
  toggleHostFiltering() {
    this.showHostFiltering = !this.showHostFiltering;
    if (this.showHostFiltering && this.hosts.length === 0) {
      this.loadHosts();
    }
  }

  /**
   * Reset to default view
   */
  resetToDefaultView() {
    this.showHostFiltering = false;
    this.selectedHostId = '';
    this.selectedFilteredQuizId = null;
    this.quizzes = [];
    this.hostFeedbackAnalytics = null;
    this.isLoading = true;
    setTimeout(() => {
      this.loadData();
    }, 100);
  }

  /**
   * Get emoji icon for stat card based on title
   */
  getStatIcon(title: string): string {
    const iconMap: { [key: string]: string } = {
      'Total Responses': '📊',
      'Average Rating': '⭐',
      'Host': '👤',
      'Quiz': '📝'
    };
    return iconMap[title] || '📈';
  }

  /**
   * Get overall sentiment label and emoji based on average rating
   */
  getSentiment(): string {
    if (!this.hostFeedbackAnalytics?.totalResponses || this.hostFeedbackAnalytics.totalResponses === 0) {
      return '📭 No Feedback';
    }

    const rating = this.hostFeedbackAnalytics.averageRating;
    if (rating >= 4.5) {
      return '😍 Excellent';
    } else if (rating >= 4.0) {
      return '😄 Very Good';
    } else if (rating >= 3.5) {
      return '😊 Good';
    } else if (rating >= 3.0) {
      return '🙂 Decent';
    } else if (rating >= 2.0) {
      return '😐 Average';
    } else {
      return '😞 Needs Work';
    }
  }

  /**
   * Get CSS class for sentiment card based on average rating
   */
  getSentimentClass(): string {
    if (!this.hostFeedbackAnalytics?.totalResponses || this.hostFeedbackAnalytics.totalResponses === 0) {
      return 'sentiment-neutral';
    }

    const rating = this.hostFeedbackAnalytics.averageRating;
    if (rating >= 4.0) {
      return 'sentiment-positive';
    } else if (rating >= 3.0) {
      return 'sentiment-neutral';
    } else {
      return 'sentiment-negative';
    }
  }

  /**
   * Calculate positive feedback percentage (ratings >= 4)
   */
  getPositiveFeedbackPercentage(): number {
    if (!this.hostFeedbackAnalytics?.ratingDistribution || 
        this.hostFeedbackAnalytics.ratingDistribution.length === 0) {
      return 0;
    }

    const totalResponses = this.hostFeedbackAnalytics.totalResponses;
    if (totalResponses === 0) return 0;

    const positiveRatings = this.hostFeedbackAnalytics.ratingDistribution
      .filter(item => item.rating >= 4)
      .reduce((sum, item) => sum + item.count, 0);

    return Math.round((positiveRatings / totalResponses) * 100);
  }

  /**
   * Calculate neutral feedback percentage (ratings = 3)
   */
  getNeutralFeedbackPercentage(): number {
    if (!this.hostFeedbackAnalytics?.ratingDistribution || 
        this.hostFeedbackAnalytics.ratingDistribution.length === 0) {
      return 0;
    }

    const totalResponses = this.hostFeedbackAnalytics.totalResponses;
    if (totalResponses === 0) return 0;

    const neutralRatings = this.hostFeedbackAnalytics.ratingDistribution
      .filter(item => item.rating === 3)
      .reduce((sum, item) => sum + item.count, 0);

    return Math.round((neutralRatings / totalResponses) * 100);
  }

  /**
   * Calculate negative feedback percentage (ratings < 3)
   */
  getNegativeFeedbackPercentage(): number {
    if (!this.hostFeedbackAnalytics?.ratingDistribution || 
        this.hostFeedbackAnalytics.ratingDistribution.length === 0) {
      return 0;
    }

    const totalResponses = this.hostFeedbackAnalytics.totalResponses;
    if (totalResponses === 0) return 0;

    const negativeRatings = this.hostFeedbackAnalytics.ratingDistribution
      .filter(item => item.rating < 3)
      .reduce((sum, item) => sum + item.count, 0);

    return Math.round((negativeRatings / totalResponses) * 100);
  }

  /**
   * Export analytics report as PDF
   */
  async exportReportAsPDF(): Promise<void> {
    if (!this.hostFeedbackAnalytics) {
      alert('No data available to export');
      return;
    }

    try {
      console.log('Starting PDF export...');
      
      // Import pdfMake library
      const pdfMakeModule = await import('pdfmake/build/pdfmake');
      const vfsModule = await import('pdfmake/build/vfs_fonts');
      
      const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
      const vfs = (vfsModule as any).default || vfsModule;
      
      console.log('pdfMake loaded:', !!pdfMake);
      console.log('vfs loaded:', !!vfs);
      
      // Configure fonts
      if (vfs && pdfMake) {
        pdfMake.vfs = vfs.pdfMake?.vfs || vfs.vfs || vfs;
        console.log('VFS configured');
      }

      // Prepare document content
      const docContent: any[] = [
        {
          text: '📊 Quiz Analytics Report',
          fontSize: 20,
          bold: true,
          color: '#0066cc',
          margin: [0, 0, 0, 15]
        },
        {
          text: `Generated: ${new Date().toLocaleString()}`,
          fontSize: 10,
          color: '#666',
          margin: [0, 0, 0, 15]
        },
        {
          text: 'Quiz Information',
          fontSize: 14,
          bold: true,
          color: '#0066cc',
          margin: [0, 15, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['50%', '50%'],
            body: [
              [
                { text: 'Host', bold: true, color: '#fff', fillColor: '#0066cc', alignment: 'left' },
                { text: 'Quiz', bold: true, color: '#fff', fillColor: '#0066cc', alignment: 'left' }
              ],
              [
                this.hostFeedbackAnalytics.hostName || 'N/A',
                this.hostFeedbackAnalytics.quizName || 'N/A'
              ]
            ]
          },
          margin: [0, 0, 0, 15]
        },
        {
          text: 'Key Metrics',
          fontSize: 14,
          bold: true,
          color: '#0066cc',
          margin: [0, 15, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'Responses', bold: true, color: '#fff', fillColor: '#0066cc', alignment: 'center' },
                { text: 'Avg Rating', bold: true, color: '#fff', fillColor: '#0066cc', alignment: 'center' },
                { text: 'Positive %', bold: true, color: '#fff', fillColor: '#0066cc', alignment: 'center' },
                { text: 'Needs Work %', bold: true, color: '#fff', fillColor: '#0066cc', alignment: 'center' }
              ],
              [
                { text: (this.hostFeedbackAnalytics.totalResponses || 0).toString(), alignment: 'center' },
                { text: (this.hostFeedbackAnalytics.averageRating || 0).toFixed(2), alignment: 'center' },
                { text: this.getPositiveFeedbackPercentage() + '%', alignment: 'center' },
                { text: this.getNegativeFeedbackPercentage() + '%', alignment: 'center' }
              ]
            ]
          },
          margin: [0, 0, 0, 15]
        }
      ];

      // Add rating distribution if available
      if (this.hostFeedbackAnalytics.ratingDistribution && this.hostFeedbackAnalytics.ratingDistribution.length > 0) {
        docContent.push({
          text: 'Rating Distribution',
          fontSize: 14,
          bold: true,
          color: '#0066cc',
          margin: [0, 15, 0, 10]
        });

        const ratingBody: any[] = [
          [
            { text: 'Rating', bold: true, color: '#fff', fillColor: '#0066cc' },
            { text: 'Count', bold: true, color: '#fff', fillColor: '#0066cc' }
          ]
        ];

        for (const rd of this.hostFeedbackAnalytics.ratingDistribution) {
          ratingBody.push([
            `⭐ ${rd.rating} Stars`,
            (rd.count || 0).toString()
          ]);
        }

        docContent.push({
          table: {
            headerRows: 1,
            widths: ['50%', '50%'],
            body: ratingBody
          },
          margin: [0, 0, 0, 15]
        });
      }

      // Add emoji distribution if available
      if (this.hostFeedbackAnalytics.emojiBreakdown && this.hostFeedbackAnalytics.emojiBreakdown.length > 0) {
        docContent.push({
          text: 'Emoji Reactions',
          fontSize: 14,
          bold: true,
          color: '#0066cc',
          margin: [0, 15, 0, 10]
        });

        // Emoji mapping for names
        const emojiMap: any = {
          '😄': 'Very Happy',
          '😀': 'Happy',
          '🙂': 'Neutral',
          '☹️': 'Sad',
          '😞': 'Very Sad',
          '😊': 'Happy',
          '😍': 'Love It',
          '🤔': 'Thinking',
          '😢': 'Sad',
          '😡': 'Angry',
          '👍': 'Thumbs Up',
          '❤️': 'Love',
          '🎉': 'Celebration',
          '🔥': 'Fire',
          '💯': 'Perfect'
        };

        const emojiBody: any[] = [
          [
            { text: 'Emoji', bold: true, color: '#fff', fillColor: '#0066cc' },
            { text: 'Sentiment', bold: true, color: '#fff', fillColor: '#0066cc' },
            { text: 'Count', bold: true, color: '#fff', fillColor: '#0066cc' }
          ]
        ];

        for (const ed of this.hostFeedbackAnalytics.emojiBreakdown) {
          const emojiName = emojiMap[ed.emojiReaction] || 'Reaction';
          emojiBody.push([
            ed.emojiReaction || '?',
            emojiName,
            (ed.totalCount || 0).toString()
          ]);
        }

        docContent.push({
          table: {
            headerRows: 1,
            widths: ['20%', '50%', '30%'],
            body: emojiBody
          },
          margin: [0, 0, 0, 15]
        });
      }

      docContent.push({
        text: '© CTS Quiz Analytics System',
        fontSize: 9,
        color: '#999',
        alignment: 'center',
        margin: [0, 20, 0, 0]
      });

      const docDefinition: any = {
        content: docContent,
        pageMargins: [40, 40, 40, 40]
      };

      console.log('Document definition created');
      
      if (!pdfMake || !pdfMake.createPdf) {
        throw new Error('pdfMake not properly initialized');
      }

      const pdf = pdfMake.createPdf(docDefinition);
      const filename = `Analytics_Report_${(this.hostFeedbackAnalytics.quizName || 'Quiz').replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
      
      console.log('Downloading PDF as:', filename);
      pdf.download(filename);
      console.log('PDF download initiated');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Toggle drag and drop mode for stat cards
   */
  toggleDragMode(): void {
    this.isDragEnabled = !this.isDragEnabled;
    console.log('Drag mode:', this.isDragEnabled ? 'Enabled' : 'Disabled');
  }

  /**
   * Handle stat card drop event
   */
  onStatCardDrop(event: any): void {
    // Reorder the stats array
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.stats, event.previousIndex, event.currentIndex);
      console.log('Stats reordered:', this.stats);
    }
  }
}

