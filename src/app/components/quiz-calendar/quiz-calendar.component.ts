import { Component, OnInit, signal, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarService } from '../../services/calendar.service';
import { CalendarDate, QuizCalendar } from '../../models/calendar.models';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, format, addMonths, subMonths } from 'date-fns';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasQuizzes: boolean;
  currentHostQuizCount: number;
  otherHostsQuizCount: number;
  quizzes: QuizCalendar[];
}

@Component({
  selector: 'app-quiz-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-calendar.component.html',
  styleUrls: ['./quiz-calendar.component.css']
})
export class QuizCalendarComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  
  private calendarService = inject(CalendarService);
  
  currentMonth = signal<Date>(new Date());
  calendarDays = signal<CalendarDay[]>([]);
  selectedDate = signal<Date | null>(null);
  selectedDateQuizzes = signal<QuizCalendar[]>([]);
  loading = signal(false);
  
  currentHostId = '2463579'; // This should match the host dashboard
  
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  ngOnInit(): void {
    this.loadCalendarData();
  }
  
  loadCalendarData(): void {
    this.loading.set(true);
    this.calendarService.getCalendarData(this.currentHostId).subscribe({
      next: (response) => {
        console.log('Calendar response:', response);
        this.generateCalendar(response.dates, response.quizzes);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading calendar data:', error);
        // Generate empty calendar even on error
        this.generateCalendar([], []);
        this.loading.set(false);
      }
    });
  }
  
  generateCalendar(dates: CalendarDate[], quizzes: QuizCalendar[]): void {
    const month = this.currentMonth();
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days: CalendarDay[] = [];
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dateData = dates.find(d => format(new Date(d.date), 'yyyy-MM-dd') === dateStr);
      const dateQuizzes = quizzes.filter(q => 
        q.publishedDate && format(new Date(q.publishedDate), 'yyyy-MM-dd') === dateStr
      );
      
      days.push({
        date: new Date(currentDate),
        isCurrentMonth: isSameMonth(currentDate, month),
        isToday: isSameDay(currentDate, new Date()),
        hasQuizzes: (dateData?.quizCount || 0) > 0,
        currentHostQuizCount: dateData?.currentHostQuizCount || 0,
        otherHostsQuizCount: dateData?.otherHostsQuizCount || 0,
        quizzes: dateQuizzes
      });
      
      currentDate = addDays(currentDate, 1);
    }
    
    console.log('Generated calendar days:', days.length, days);
    this.calendarDays.set(days);
  }
  
  previousMonth(): void {
    this.currentMonth.set(subMonths(this.currentMonth(), 1));
    this.loadCalendarData();
  }
  
  nextMonth(): void {
    this.currentMonth.set(addMonths(this.currentMonth(), 1));
    this.loadCalendarData();
  }
  
  selectDate(day: CalendarDay): void {
    if (day.hasQuizzes) {
      this.selectedDate.set(day.date);
      this.selectedDateQuizzes.set(day.quizzes);
    }
  }
  
  closeDetails(): void {
    this.selectedDate.set(null);
    this.selectedDateQuizzes.set([]);
  }
  
  closeCalendar(): void {
    this.close.emit();
  }
  
  getMonthYear(): string {
    return format(this.currentMonth(), 'MMMM yyyy');
  }
  
  getDayNumber(day: CalendarDay): number {
    return day.date.getDate();
  }
  
  isSameDay(date1: Date, date2: Date): boolean {
    return isSameDay(date1, date2);
  }
}
