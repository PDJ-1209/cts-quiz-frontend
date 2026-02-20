import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PollService } from '../services/poll.service';
import { AdminService } from '../services/admin.service';
import { PollOverview, PollResult } from '../models/ipoll';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

Chart.register(...registerables);

interface PollSession {
  id: number;
  pollTitle: string;
  pollQuestion: string;
  createdAt: Date;
  publishedAt: Date;
  participantCount: number;
  isActive: boolean;
  sessionId: number;
  participants: PollParticipant[];
}

interface PollParticipant {
  name: string;
  votedOption: string;
}

interface ChartOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-result-poll',
  imports: [CommonModule, FormsModule],
  templateUrl: './result-poll.component.html',
  styleUrl: './result-poll.component.css'
})
export class ResultPollComponent implements OnInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  private pollService = inject(PollService);
  private adminService = inject(AdminService);
  
  // Data properties
  pollSessions: PollSession[] = [];
  filteredSessions: PollSession[] = [];
  activeCount: number = 0;
  inactiveCount: number = 0;
  
  // Search
  searchQuery: string = '';
  
  // Chart properties
  currentChart: Chart | null = null;
  selectedChartType: string = '';
  selectedSessionForChart: PollSession | null = null;
  showChartModal: boolean = false;
  
  // Loading state
  loading: boolean = false;
  
  // Dropdown state
  openDropdownId: number | null = null;
  
  chartOptions: ChartOption[] = [
    { label: 'Pie Chart', value: 'pie' },
    { label: 'Donut Chart', value: 'doughnut' },
    { label: 'Bar Graph', value: 'bar' },
    { label: 'Line Graph', value: 'line' }
  ];

  ngOnInit(): void {
    this.loadPollData();
  }

  loadPollData(): void {
    this.loading = true;
    
    // Fetch polls from the backend
    this.adminService.getPolls().pipe(
      catchError(error => {
        console.error('Error loading polls:', error);
        return of([]); // Return empty array on error
      })
    ).subscribe({
      next: (polls: any[]) => {
        console.log('Polls loaded from database:', polls);
        
        // Transform backend data to component format
        this.pollSessions = polls.map((poll: any, index) => {
          // Determine if poll is active based on status
          // Support multiple property name formats from backend
          const pollStatus = poll.pollStatus || poll.PollStatus || poll.poll_status || '';
          const isActive = pollStatus.toLowerCase() === 'active' || 
                          pollStatus.toLowerCase() === 'published';
          
          // Get participant count (you might need to fetch this from results)
          const participantCount = poll.participantCount || poll.ParticipantCount || poll.participant_count || 0;
          
          // Get created and published dates
          const createdAt = poll.createdAt || poll.CreatedAt || poll.created_at || new Date();
          const publishedAt = poll.publishedAt || poll.PublishedAt || poll.published_at || poll.createdAt || poll.CreatedAt || poll.created_at || new Date();
          
          return {
            id: poll.pollId || poll.PollId || poll.poll_id || index + 1,
            pollTitle: poll.pollTitle || poll.PollTitle || poll.poll_title || 'Untitled Poll',
            pollQuestion: poll.pollQuestion || poll.PollQuestion || poll.poll_question || '',
            createdAt: new Date(createdAt),
            publishedAt: new Date(publishedAt),
            participantCount: participantCount,
            isActive: isActive,
            sessionId: poll.sessionId || poll.SessionId || poll.session_id || 0,
            participants: [] // Will be loaded when needed for export
          };
        });
        
        this.filteredSessions = [...this.pollSessions];
        this.updateCounts();
        this.loading = false;
        
        // Load detailed results for each poll
        this.loadPollResults();
      },
      error: (error) => {
        console.error('Failed to load polls:', error);
        this.loading = false;
        this.pollSessions = [];
        this.filteredSessions = [];
        this.updateCounts();
      }
    });
  }

  loadPollResults(): void {
    // Load results for each poll to get participant counts and vote data
    const resultRequests = this.pollSessions.map(session => 
      this.pollService.getPollResults(session.id).pipe(
        catchError(error => {
          console.warn(`Could not load results for poll ${session.id}:`, error);
          return of(null);
        })
      )
    );

    if (resultRequests.length > 0) {
      forkJoin(resultRequests).subscribe({
        next: (results: (PollResult | null)[]) => {
          results.forEach((result, index) => {
            if (result && this.pollSessions[index]) {
              // Update participant count from results
              this.pollSessions[index].participantCount = result.totalVotes || 0;
              
              // Transform vote data to participants format
              if (result.options && result.options.length > 0) {
                const participants: PollParticipant[] = [];
                result.options.forEach(option => {
                  // Create mock participant entries based on vote counts
                  for (let i = 0; i < option.voteCount; i++) {
                    participants.push({
                      name: `Participant ${participants.length + 1}`,
                      votedOption: option.optionLabel
                    });
                  }
                });
                this.pollSessions[index].participants = participants;
              }
            }
          });
          
          // Update filtered sessions and counts
          this.onSearch();
          this.updateCounts();
        },
        error: (error) => {
          console.error('Error loading poll results:', error);
        }
      });
    }
  }

  updateCounts(): void {
    this.activeCount = this.pollSessions.filter(s => s.isActive).length;
    this.inactiveCount = this.pollSessions.filter(s => !s.isActive).length;
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredSessions = [...this.pollSessions];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredSessions = this.pollSessions.filter(session =>
        session.pollTitle.toLowerCase().includes(query) ||
        session.pollQuestion.toLowerCase().includes(query)
      );
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filteredSessions = [...this.pollSessions];
  }

  toggleDropdown(sessionId: number, event: Event): void {
    event.stopPropagation();
    this.openDropdownId = this.openDropdownId === sessionId ? null : sessionId;
  }

  closeDropdown(): void {
    this.openDropdownId = null;
  }

  isDropdownOpen(sessionId: number): boolean {
    return this.openDropdownId === sessionId;
  }

  openChartModal(session: PollSession, chartType: string): void {
    this.closeDropdown();
    this.selectedSessionForChart = session;
    this.selectedChartType = chartType;
    this.showChartModal = true;
    
    // Load poll results before showing chart if not already loaded
    if (!session.participants || session.participants.length === 0) {
      this.pollService.getPollResults(session.id).pipe(
        catchError(error => {
          console.error('Error loading poll results for chart:', error);
          return of(null);
        })
      ).subscribe({
        next: (result: PollResult | null) => {
          if (result && result.options && result.options.length > 0) {
            const participants: PollParticipant[] = [];
            result.options.forEach(option => {
              for (let i = 0; i < option.voteCount; i++) {
                participants.push({
                  name: `Participant ${participants.length + 1}`,
                  votedOption: option.optionLabel
                });
              }
            });
            session.participants = participants;
            session.participantCount = result.totalVotes || 0;
          }
          
          setTimeout(() => {
            this.createChart(chartType);
          }, 150);
        }
      });
    } else {
      // Data already loaded, create chart immediately
      setTimeout(() => {
        this.createChart(chartType);
      }, 150);
    }
  }

  closeChartModal(): void {
    this.showChartModal = false;
    if (this.currentChart) {
      this.currentChart.destroy();
      this.currentChart = null;
    }
  }

  createChart(chartType: string): void {
    if (this.currentChart) {
      this.currentChart.destroy();
    }

    if (!this.selectedSessionForChart || !this.chartCanvas) {
      console.error('Cannot create chart: missing session or canvas');
      return;
    }

    // Aggregate vote counts from participants
    const voteCounts: { [key: string]: number } = {};
    
    if (this.selectedSessionForChart.participants && this.selectedSessionForChart.participants.length > 0) {
      this.selectedSessionForChart.participants.forEach(p => {
        voteCounts[p.votedOption] = (voteCounts[p.votedOption] || 0) + 1;
      });
    } else {
      // If no participants data, show a placeholder
      voteCounts['No votes recorded'] = 1;
    }

    const labels = Object.keys(voteCounts);
    const data = Object.values(voteCounts);
    const colors = this.generateColors(labels.length);

    const config: ChartConfiguration = {
      type: chartType as any,
      data: {
        labels: labels,
        datasets: [{
          label: 'Votes',
          data: data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          },
          title: {
            display: true,
            text: this.selectedSessionForChart.pollTitle,
            font: { size: 16, weight: 'bold' },
            padding: 20
          }
        }
      }
    };

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (ctx) {
      this.currentChart = new Chart(ctx, config);
    }
  }

  generateColors(count: number): string[] {
    const colors = [
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 99, 132, 0.7)',
      'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 159, 64, 0.7)',
      'rgba(199, 199, 199, 0.7)',
      'rgba(83, 102, 255, 0.7)',
      'rgba(255, 99, 255, 0.7)',
      'rgba(99, 255, 132, 0.7)'
    ];
    return colors.slice(0, count);
  }

  downloadChart(): void {
    if (!this.currentChart) {
      alert('No chart to download!');
      return;
    }

    const canvas = this.chartCanvas.nativeElement;
    canvas.toBlob((blob) => {
      if (blob) {
        const fileName = `${this.selectedSessionForChart?.pollTitle.replace(/[^a-z0-9]/gi, '_')}_${this.selectedChartType}_chart.png`;
        saveAs(blob, fileName);
      }
    });
  }

  downloadExcel(session: PollSession): void {
    // Load poll results if not already loaded
    if (!session.participants || session.participants.length === 0) {
      this.pollService.getPollResults(session.id).pipe(
        catchError(error => {
          console.error('Error loading poll results for Excel:', error);
          alert('Failed to load poll results. Please try again.');
          return of(null);
        })
      ).subscribe({
        next: (result: PollResult | null) => {
          if (result && result.options && result.options.length > 0) {
            const participants: PollParticipant[] = [];
            result.options.forEach(option => {
              for (let i = 0; i < option.voteCount; i++) {
                participants.push({
                  name: `Participant ${participants.length + 1}`,
                  votedOption: option.optionLabel
                });
              }
            });
            session.participants = participants;
            session.participantCount = result.totalVotes || 0;
            
            // Now generate Excel with loaded data
            this.generateExcelFile(session);
          } else {
            alert('No participant data available for this poll.');
          }
        }
      });
      return;
    }
    
    // Data already loaded, generate Excel directly
    this.generateExcelFile(session);
  }

  private generateExcelFile(session: PollSession): void {
    // Prepare data for Excel
    const excelData = session.participants.map((participant, index) => ({
      'No.': index + 1,
      'Participant Name': participant.name,
      'Voted Option': participant.votedOption,
      'Poll Title': session.pollTitle,
      'Poll Question': session.pollQuestion,
      'Published At': this.formatDateTime(session.publishedAt)
    }));

    // Create worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // No.
      { wch: 25 }, // Participant Name
      { wch: 20 }, // Voted Option
      { wch: 35 }, // Poll Title
      { wch: 35 }, // Poll Question
      { wch: 20 }  // Published At
    ];

    // Create workbook
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Poll Results');

    // Generate file name
    const fileName = `${session.pollTitle.replace(/[^a-z0-9]/gi, '_')}_Results.xlsx`;

    // Save file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
  }

  formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'badge bg-success' : 'badge bg-secondary';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  getTotalParticipants(): number {
    return this.filteredSessions.reduce((sum, session) => sum + session.participantCount, 0);
  }
}
