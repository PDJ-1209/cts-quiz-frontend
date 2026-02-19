import { Component, OnInit, OnDestroy, signal, computed, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SurveyService } from '../../services/survey.service';
import { SurveyOverview, SurveyQuestionOverview, SurveyResult } from '../../models/isurvey';

Chart.register(...registerables);

interface QuestionAnalytics {
  questionId: number;
  questionText: string;
  responses: { label: string; count: number }[];
  totalResponses: number;
}

@Component({
  selector: 'app-result-survey',
  imports: [CommonModule, FormsModule],
  templateUrl: './result-survey.component.html',
  styleUrl: './result-survey.component.css'
})
export class ResultSurveyComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChildren('wordcloudCanvas') wordcloudCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  surveyId = signal<number>(0);
  loading = signal<boolean>(true);
  surveyData = signal<SurveyOverview | null>(null);
  questions = signal<SurveyQuestionOverview[]>([]);
  activeQuestionId = signal<number | null>(null);
  
  // Search functionality
  searchQuery = signal<string>('');
  filteredQuestions = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return this.questions();
    }
    return this.questions().filter(question => 
      question.questionText.toLowerCase().includes(query)
    );
  });
  
  // Analytics data
  totalQuestions = computed(() => this.questions().length);
  totalParticipants = signal<number>(0);
  publishedDate = signal<string>('N/A');
  totalVotes = signal<number>(0);

  // Chart management
  selectedChartTypes: { [key: number]: string } = {};
  activeCharts: { [key: number]: Chart } = {};
  questionAnalytics: { [key: number]: QuestionAnalytics } = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['surveyId'];
      if (id) {
        this.surveyId.set(+id);
        this.loadSurveyData();
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

  async loadSurveyData(): Promise<void> {
    try {
      this.loading.set(true);
      
      // Fetch survey details
      this.surveyService.getSurveyById(this.surveyId()).subscribe({
        next: (survey: any) => {
          const mappedSurvey: SurveyOverview = {
            surveyId: survey.surveyId || survey.SurveyId,
            sessionId: survey.sessionId || survey.SessionId,
            sessionCode: survey.sessionCode || survey.SessionCode,
            title: survey.title || survey.Title,
            description: survey.description || survey.Description,
            isAnonymous: survey.isAnonymous || survey.IsAnonymous,
            status: survey.status || survey.Status,
            startTime: survey.startTime || survey.StartTime,
            endTime: survey.endTime || survey.EndTime,
            questions: (survey.questions || survey.Questions || []).map((q: any) => ({
              surveyQuestionId: q.surveyQuestionId || q.SurveyQuestionId,
              sessionId: q.sessionId || q.SessionId,
              questionText: q.questionText || q.QuestionText,
              questionType: q.questionType || q.QuestionType,
              questionOrder: q.questionOrder || q.QuestionOrder,
              isRequired: q.isRequired || q.IsRequired,
              scaleMin: q.scaleMin || q.ScaleMin,
              scaleMax: q.scaleMax || q.ScaleMax,
              options: (q.options || q.Options || []).map((opt: any) => ({
                optionId: opt.optionId || opt.OptionId,
                optionText: opt.optionText || opt.OptionText,
                displayOrder: opt.displayOrder || opt.DisplayOrder,
                scoreValue: opt.scoreValue || opt.ScoreValue
              }))
            }))
          };
          
          this.surveyData.set(mappedSurvey);
          this.questions.set(mappedSurvey.questions || []);
          
          // Initialize chart types for each question
          this.questions().forEach(q => {
            this.selectedChartTypes[q.surveyQuestionId] = 'pie';
          });

          // Set published date
          if (mappedSurvey.startTime) {
            this.publishedDate.set(new Date(mappedSurvey.startTime).toLocaleDateString());
          }

          // Fetch analytics data
          this.loadAnalyticsData();
        },
        error: (error: any) => {
          console.error('Error loading survey:', error);
          this.loading.set(false);
        }
      });
    } catch (error) {
      console.error('Error loading survey data:', error);
      this.loading.set(false);
    }
  }

  async loadAnalyticsData(): Promise<void> {
    try {
      // Fetch survey results/analytics
      this.surveyService.getSurveyResults(this.surveyId()).subscribe({
        next: (results: SurveyResult) => {
          // Process results
          this.totalParticipants.set(results.totalResponses || 0);
          
          let totalVoteCount = 0;
          
          // Map question results to analytics
          results.questionResults?.forEach(qResult => {
            const analytics: QuestionAnalytics = {
              questionId: qResult.questionId,
              questionText: qResult.questionText,
              responses: [],
              totalResponses: 0
            };

            if (qResult.options && qResult.options.length > 0) {
              analytics.responses = qResult.options.map(opt => ({
                label: opt.optionText,
                count: opt.count
              }));
              analytics.totalResponses = qResult.options.reduce((sum, opt) => sum + opt.count, 0);
              totalVoteCount += analytics.totalResponses;
            } else if (qResult.textResponses && qResult.textResponses.length > 0) {
              // For text responses, create word frequency
              const wordFreq = this.calculateWordFrequency(qResult.textResponses);
              analytics.responses = Object.entries(wordFreq).map(([word, count]) => ({
                label: word,
                count: count as number
              }));
              analytics.totalResponses = qResult.textResponses.length;
              totalVoteCount += analytics.totalResponses;
            }

            this.questionAnalytics[qResult.questionId] = analytics;
          });

          this.totalVotes.set(totalVoteCount);
          this.loading.set(false);
        },
        error: (error: any) => {
          console.error('Error loading analytics:', error);
          console.warn('API endpoint may not be available. Please ensure the backend supports /survey/results/{surveyId}');
          this.loading.set(false);
        }
      });
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.loading.set(false);
    }
  }

  calculateWordFrequency(textResponses: string[]): { [word: string]: number } {
    const wordFreq: { [word: string]: number } = {};
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were']);

    textResponses.forEach(response => {
      const words = response.toLowerCase().split(/\s+/);
      words.forEach(word => {
        word = word.replace(/[^\w]/g, '');
        if (word.length > 2 && !stopWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    return wordFreq;
  }

  searchQuestions(): void {
    // Trigger computed signal update
    this.filteredQuestions();
  }

  toggleChartView(questionId: number): void {
    if (this.activeQuestionId() === questionId) {
      // Hide chart
      this.activeQuestionId.set(null);
      if (this.activeCharts[questionId]) {
        this.activeCharts[questionId].destroy();
        delete this.activeCharts[questionId];
      }
    } else {
      // Show chart
      this.activeQuestionId.set(questionId);
      setTimeout(() => {
        this.renderChart(questionId);
      }, 100);
    }
  }

  onChartTypeChange(questionId: number): void {
    if (this.activeQuestionId() === questionId) {
      setTimeout(() => {
        this.renderChart(questionId);
      }, 100);
    }
  }

  renderChart(questionId: number): void {
    const chartType = this.selectedChartTypes[questionId];
    const analytics = this.questionAnalytics[questionId];

    if (!analytics) {
      console.warn('No analytics data for question:', questionId);
      return;
    }

    // Destroy existing chart
    if (this.activeCharts[questionId]) {
      this.activeCharts[questionId].destroy();
    }

    if (chartType === 'wordcloud') {
      this.renderWordCloud(questionId, analytics);
    } else {
      this.renderRegularChart(questionId, chartType, analytics);
    }
  }

  renderRegularChart(questionId: number, chartType: string, analytics: QuestionAnalytics): void {
    const canvasId = `chart-${questionId}`;
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
          label: 'Response Count',
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
            text: analytics.questionText,
            font: { size: 16, weight: 'bold' }
          }
        }
      }
    };

    this.activeCharts[questionId] = new Chart(ctx, config);
  }

  renderWordCloud(questionId: number, analytics: QuestionAnalytics): void {
    const canvasId = `wordcloud-${questionId}`;
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

  downloadChart(questionId: number): void {
    const chartType = this.selectedChartTypes[questionId];
    
    if (chartType === 'wordcloud') {
      const canvasId = `wordcloud-${questionId}`;
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (canvas) {
        const link = document.createElement('a');
        link.download = `survey-wordcloud-q${questionId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } else {
      const chart = this.activeCharts[questionId];
      if (chart) {
        const link = document.createElement('a');
        link.download = `survey-chart-q${questionId}.png`;
        link.href = chart.toBase64Image();
        link.click();
      }
    }
  }

  exportAnalytics(): void {
    // TODO: Implement exportAnalytics once getAllSurveyResponses API is available
    alert('Export functionality is not yet implemented. The API endpoint is pending.');
    
    /* this.loading.set(true);
    
    // Fetch all survey responses with participant details from database
    this.surveyService.getAllSurveyResponses(this.surveyId()).subscribe({
      next: (responses: any[]) => {
        if (!responses || responses.length === 0) {
          alert('No participant responses found for this survey.');
          this.loading.set(false);
          return;
        }

        // Prepare data for Excel export
        const excelData = this.prepareExcelData(responses);
        
        // Create worksheet
        const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);
        
        // Create workbook
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Survey Responses');
        
        // Generate Excel file and download
        const fileName = `survey-responses-${this.surveyId()}-${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        this.loading.set(false);
      },
      error: (error: any) => {
        console.error('Error fetching survey responses:', error);
        alert('Failed to fetch survey responses. Please ensure the API endpoint is available.');
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
      const questionId = response.surveyQuestionId || response.SurveyQuestionId;
      const questionText = response.questionText || response.QuestionText;
      const responseText = response.responseText || response.ResponseText;
      const selectedOption = response.selectedOptionText || response.SelectedOptionText;
      const responseNumber = response.responseNumber || response.ResponseNumber;
      
      const key = `${participantId}_${participantName}`;
      
      if (!participantMap.has(key)) {
        participantMap.set(key, {
          participant_name: participantName
        });
      }
      
      const participantData = participantMap.get(key);
      
      // Find question order
      const question = this.questions().find(q => q.surveyQuestionId === questionId);
      const questionKey = question ? `Question_${question.questionOrder}` : `Question_${questionId}`;
      const responseKey = question ? `Response_${question.questionOrder}` : `Response_${questionId}`;
      
      // Store question and response
      participantData[questionKey] = questionText || '';
      
      // Determine the response value
      let responseValue = '';
      if (selectedOption) {
        responseValue = selectedOption;
      } else if (responseText) {
        responseValue = responseText;
      } else if (responseNumber !== null && responseNumber !== undefined) {
        responseValue = responseNumber.toString();
      } else {
        responseValue = 'No response';
      }
      
      participantData[responseKey] = responseValue;
    });
    
    // Convert map to array
    participantMap.forEach((data) => {
      excelData.push(data);
    });
    
    return excelData;
  }
}
