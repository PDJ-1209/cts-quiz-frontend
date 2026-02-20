import { Component, OnInit, OnDestroy, signal, computed, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { PollService } from '../../services/poll.service';
import { PollOverview, PollResult } from '../../models/ipoll';

Chart.register(...registerables);

interface PollAnalytics {
  pollId: number;
  pollQuestion: string;
  responses: { label: string; count: number }[];
  totalResponses: number;
}

@Component({
  selector: 'app-result-poll',
  imports: [CommonModule, FormsModule],
  templateUrl: './result-poll.component.html',
  styleUrl: './result-poll.component.css'
})
export class ResultPollComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren('wordcloudCanvas') wordcloudCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  pollId = signal<number>(0);
  loading = signal<boolean>(true);
  pollData = signal<PollOverview | null>(null);
  polls = signal<PollOverview[]>([]);
  activePollId = signal<number | null>(null);
  
  // Search functionality
  searchQuery = signal<string>('');
  filteredPolls = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.polls();
    }
    return this.polls().filter(poll => 
      poll.pollQuestion.toLowerCase().includes(query) ||
      poll.pollTitle.toLowerCase().includes(query)
    );
  });
  
  // Analytics data
  totalQuestions = computed(() => this.polls().length);
  totalParticipants = signal<number>(0);
  publishedDate = signal<string>('N/A');
  totalVotes = signal<number>(0);

  // Chart management
  selectedChartTypes: { [key: number]: string } = {};
  activeCharts: { [key: number]: Chart } = {};
  pollAnalytics: { [key: number]: PollAnalytics } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pollService: PollService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['pollId'];
      if (id) {
        this.pollId.set(+id);
        this.loadPollData();
      }
    });
  }

  ngAfterViewInit(): void {
    // Initialize charts after view is ready
  }

  ngOnDestroy(): void {
    // Destroy all active charts
    Object.values(this.activeCharts).forEach(chart => {
      if (chart) chart.destroy();
    });
  }

  async loadPollData(): Promise<void> {
    try {
      this.loading.set(true);
      
      // TODO: Implement getPollById in PollService
      console.warn('getPollById not implemented. Using mock data.');
      this.loading.set(false);
      
      /* // Fetch poll details
      this.pollService.getPollById(this.pollId()).subscribe({
        next: (poll: PollOverview) => {
          this.pollData.set(poll);
          // For single poll, put it in array for consistent handling
          this.polls.set([poll]);
          
          // Initialize chart types for each poll
          this.selectedChartTypes[poll.pollId] = 'pie';

          // Set published date
          if (poll.startTime) {
            this.publishedDate.set(new Date(poll.startTime).toLocaleDateString());
          }

          // Fetch analytics data
          this.loadAnalyticsData();
        },
        error: (error: any) => {
          console.error('Error loading poll:', error);
          this.loading.set(false);
        }
      }); */
    } catch (error) {
      console.error('Error loading poll data:', error);
      this.loading.set(false);
    }
  }

  async loadAnalyticsData(): Promise<void> {
    try {
      // Fetch poll results/analytics
      this.pollService.getPollResults(this.pollId()).subscribe({
        next: (results: PollResult) => {
          // Process results
          this.totalParticipants.set(results.totalVotes || 0);
          
          const analytics: PollAnalytics = {
            pollId: results.pollId,
            pollQuestion: results.pollQuestion,
            responses: [],
            totalResponses: results.totalVotes || 0
          };

          if (results.options && results.options.length > 0) {
            analytics.responses = results.options.map((opt: any) => ({
              label: opt.optionLabel,
              count: opt.voteCount
            }));
          }

          this.pollAnalytics[results.pollId] = analytics;
          this.totalVotes.set(results.totalVotes || 0);
          this.loading.set(false);
        },
        error: (error: any) => {
          console.error('Error loading analytics:', error);
          console.warn('API endpoint may not be available. Please ensure the backend supports /Host/Poll/results/{pollId}');
          this.loading.set(false);
        }
      });
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.loading.set(false);
    }
  }

  searchQuestions(): void {
    // Trigger computed signal update
    this.filteredPolls();
  }

  toggleChartView(pollId: number): void {
    if (this.activePollId() === pollId) {
      // Hide chart
      this.activePollId.set(null);
      if (this.activeCharts[pollId]) {
        this.activeCharts[pollId].destroy();
        delete this.activeCharts[pollId];
      }
    } else {
      // Show chart
      this.activePollId.set(pollId);
      setTimeout(() => {
        this.renderChart(pollId);
      }, 100);
    }
  }

  onChartTypeChange(pollId: number): void {
    if (this.activePollId() === pollId) {
      setTimeout(() => {
        this.renderChart(pollId);
      }, 100);
    }
  }

  renderChart(pollId: number): void {
    const chartType = this.selectedChartTypes[pollId];
    const analytics = this.pollAnalytics[pollId];

    if (!analytics) {
      console.warn('No analytics data for poll:', pollId);
      return;
    }

    // Destroy existing chart
    if (this.activeCharts[pollId]) {
      this.activeCharts[pollId].destroy();
    }

    if (chartType === 'wordcloud') {
      this.renderWordCloud(pollId, analytics);
    } else {
      this.renderRegularChart(pollId, chartType, analytics);
    }
  }

  renderRegularChart(pollId: number, chartType: string, analytics: PollAnalytics): void {
    const canvasId = `chart-${pollId}`;
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

    if (!canvas) {
      console.error('Canvas not found:', canvasId);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const labels = analytics.responses.map(r => r.label);
    const data = analytics.responses.map(r => r.count);

    const config: ChartConfiguration = {
      type: chartType === 'doughnut' ? 'doughnut' : chartType === 'line' ? 'line' : 'pie',
      data: {
        labels: labels,
        datasets: [{
          label: 'Vote Count',
          data: data,
          backgroundColor: this.generateColors(data.length),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 12 },
              padding: 15
            }
          },
          title: {
            display: true,
            text: analytics.pollQuestion,
            font: { size: 16, weight: 'bold' }
          }
        }
      }
    };

    this.activeCharts[pollId] = new Chart(ctx, config);
  }

  renderWordCloud(pollId: number, analytics: PollAnalytics): void {
    const canvasId = `wordcloud-${pollId}`;
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;

    if (!canvas) {
      console.error('Canvas not found for word cloud:', canvasId);
      return;
    }

    // Prepare word list for word cloud
    const wordList: [string, number][] = analytics.responses.map(r => [r.label, r.count]);

    // TODO: Install wordcloud library: npm install wordcloud @types/wordcloud
    console.warn('WordCloud library not installed.');
    
    /* // Configure and render word cloud
    WordCloud(canvas, {
      list: wordList,
      gridSize: 8,
      weightFactor: 3,
      fontFamily: 'Arial, sans-serif',
      color: () => {
        const colors = ['#0066CC', '#00A7C7', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
        return colors[Math.floor(Math.random() * colors.length)];
      },
      rotateRatio: 0.3,
      backgroundColor: '#F8FAFC',
      drawOutOfBound: false
    }); */
  }

  generateColors(count: number): string[] {
    const colors = [
      '#0066CC', '#00A7C7', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#EF4444', '#06B6D4', '#84CC16', '#F97316'
    ];
    
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  downloadChart(pollId: number): void {
    const chartType = this.selectedChartTypes[pollId];
    
    if (chartType === 'wordcloud') {
      const canvasId = `wordcloud-${pollId}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (canvas) {
        const link = document.createElement('a');
        link.download = `poll-wordcloud-${pollId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } else {
      const chart = this.activeCharts[pollId];
      if (chart) {
        const link = document.createElement('a');
        link.download = `poll-chart-${pollId}.png`;
        link.href = chart.toBase64Image();
        link.click();
      }
    }
  }

  exportAnalytics(): void {
    // TODO: Implement exportAnalytics once getAllPollResponses API is available
    alert('Export functionality is not yet implemented. The API endpoint is pending.');
    
    /* this.loading.set(true);
    
    // Fetch all poll responses with participant details from database
    this.pollService.getAllPollResponses(this.pollId()).subscribe({
      next: (responses: any[]) => {
        if (!responses || responses.length === 0) {
          alert('No participant responses found for this poll.');
          this.loading.set(false);
          return;
        }

        // Prepare data for Excel export
        const excelData = this.prepareExcelData(responses);
        
        // Create worksheet
        const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);
        
        // Create workbook
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Poll Responses');
        
        // Generate Excel file and download
        const fileName = `poll-responses-${this.pollId()}-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Error fetching poll responses:', error);
        alert('Failed to fetch poll responses. Please ensure the API endpoint is available.');
        this.loading.set(false);
      }
    }); */
  }

  prepareExcelData(responses: any[]): any[] {
    const excelData: any[] = [];
    
    // Group responses by participant
    const participantMap = new Map<string, any>();
    
    responses.forEach((response: any) => {
      const participantName = response.participantName || response.ParticipantName || 'Anonymous';
      const participantId = response.participantId || response.ParticipantId;
      const pollQuestion = response.pollQuestion || response.PollQuestion || this.pollData()?.pollQuestion;
      const selectedOption = response.selectedOptionLabel || response.SelectedOptionLabel || response.optionLabel || response.OptionLabel;
      
      const key = `${participantId}_${participantName}`;
      
      if (!participantMap.has(key)) {
        participantMap.set(key, {
          participant_name: participantName,
          question: pollQuestion || '',
          selected_option: selectedOption || 'No response'
        });
      }
    });
    
    // Convert map to array
    participantMap.forEach((data) => {
      excelData.push(data);
    });
    
    return excelData;
  }
}
