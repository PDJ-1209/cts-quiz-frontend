
import { Component, ElementRef, ViewChild, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
// IMPORTANT: import the component (v19+) – not QRCodeModule
import { QRCodeComponent } from 'angularx-qrcode';
import * as htmlToImage from 'html-to-image';
import { AddQuestionService } from '../../services/add-question.service';

@Component({
  selector: 'app-publishquiz',
  standalone: true,
  imports: [CommonModule, QRCodeComponent], // <-- use QRCodeComponent
  templateUrl: './publishquiz.component.html',
  styleUrls: ['./publishquiz.component.css'] // <-- styleUrls (plural)
})
export class PublishquizComponent implements OnInit {
  @ViewChild('reportCard') reportCard!: ElementRef<HTMLElement>;

  private store = inject(AddQuestionService);
  quizMeta = computed(() => this.store.quizMeta());
  questions = computed(() => this.store.questions());

  qrData = '';
  quizId = '';
  isPublished = false;
  errorMessage = '';

  ngOnInit(): void {
    this.publishQuiz();
  }

  async publishQuiz() {
    this.errorMessage = '';
    this.isPublished = false;
    
    // Debug: Check current state
    const currentMeta = this.store.quizMeta();
    const currentQuestions = this.store.questions();
    console.log('[Publishquiz] Current quiz meta:', currentMeta);
    console.log('[Publishquiz] Current questions count:', currentQuestions.length);
    
    try {
      const response = await this.store.createQuiz();
      console.log('[Publishquiz] Full response from createQuiz:', response);
      // Be resilient to different casing/fields from backend
      this.quizId =
        response.quizNumber ||
        (response as any)?.quiznumber ||
        (response as any)?.quiz_no ||
        (response as any)?.quiz_id ||
        (response.quizId ? String(response.quizId) : '');

      console.log('[Publishquiz] Extracted quizId:', this.quizId);

      if (!this.quizId) {
        throw new Error('Quiz number missing from server response.');
      }
      // Deep link to participant entry with quizNumber prefilled
      this.qrData = `http://localhost:4200/participant?quizNumber=${encodeURIComponent(this.quizId)}`;
      this.isPublished = true;
      console.log('[Publishquiz] QR generated for quiz', this.quizId, 'qrData=', this.qrData);
    } catch (err: any) {
      this.errorMessage = err?.message || 'Failed to publish quiz.';
      console.error('[Publishquiz] publish error', err);
    }
  }

  async downloadFullCard() {
    if (!this.reportCard) return;
    const dataUrl = await htmlToImage.toPng(this.reportCard.nativeElement, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
    });
    const link = document.createElement('a');
    link.download = `Quiz_Pass_${this.quizId}.png`;
    link.href = dataUrl;
    link.click();
  }
}
