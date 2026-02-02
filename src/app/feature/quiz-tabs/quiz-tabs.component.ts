
import {
  Component,
  signal,
  effect,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AddQuestionComponent } from '../add-question/add-question.component';
import { PreviewComponent } from '../preview/preview.component';
import { PublishquizComponent } from '../publishquiz/publishquiz.component';
import { ResultComponent } from '../result/result.component';
import { AddQuestionService } from '../../services/add-question.service';

type Tab = 'questions' | 'preview' | 'results' | 'settings';

@Component({
  selector: 'app-quiz-tabs',
  standalone: true,
  imports: [CommonModule, RouterModule, AddQuestionComponent, PreviewComponent, PublishquizComponent, ResultComponent],
  templateUrl: './quiz-tabs.component.html',
  styleUrls: ['./quiz-tabs.component.css']
})
export class QuizTabsComponent implements AfterViewInit {
  // Router + store (if/when needed)
  private router = inject(Router);
  private store = inject(AddQuestionService);

  // Tabs state via signals
  private currentTab = signal<Tab>('questions');
  setTab(tab: Tab) { this.currentTab.set(tab); }
  activeTab(): Tab { return this.currentTab(); }

  // Reference to the tabs container to set CSS variables
  @ViewChild('tabsRef', { static: true }) tabsRef!: ElementRef<HTMLDivElement>;

  // Keep a stable tab order to compute the index cleanly
  private readonly tabsOrder: Tab[] = ['questions', 'preview', 'results', 'settings'];

  constructor() {
    // Re-run whenever the active tab changes
    effect(() => {
      // effect tracks this.currentTab()
      this.updateIndicator();
    });
  }

  ngAfterViewInit(): void {
    // Initialize indicator once the view is ready
    this.updateIndicator();
  }

  /** Updates CSS variables --indicator-index & --indicator-count on the .tabs element */
  private updateIndicator(): void {
    const el = this.tabsRef?.nativeElement;
    if (!el) return;

    const totalTabs = el.querySelectorAll('.tab').length || this.tabsOrder.length;
    const activeIndex = Math.max(0, this.tabsOrder.indexOf(this.currentTab()));

    el.style.setProperty('--indicator-index', String(activeIndex));
    el.style.setProperty('--indicator-count', String(totalTabs));
  }
}
