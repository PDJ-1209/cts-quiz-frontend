// src/app/template/template.component.ts
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { temp } from '../../models/temp';
import TemplateService, { Question } from '../../services/template.service';

@Component({
  selector: 'app-template',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.css'] // 👈 plural
})
export class TemplateComponent implements OnInit {

  @Output() switchToQuestionsTab = new EventEmitter<void>();

  showModal = false;
  isEditing = false;
  isLoading = true;
  isSubmitting = false;   // 👈 new
  currentUserId = 0;

  newTemplate: temp = {
    templateName: '',
    templateType: 'PDF',
    templateConfig: '',
    createdBy: 1
  };

  templates: temp[] = [];
  selectedTemplate: temp | null = null;

  // ===== Questions panel state =====
  showQuestionsPanel = false;
  questionLoading = false;
  questions: Question[] = [];
  activeTemplateName = '';
  newQuestionText = '';

  constructor(private templateService: TemplateService) { }

  ngOnInit(): void {
    this.loadTemplates();
  }

  // READ - Load all templates
  loadTemplates(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.templateService.getAllTemplates().subscribe({
        next: (data) => {
          console.log('✅ Templates loaded:', data);
          this.templates = data || [];
          this.isLoading = false;
        },
        error: (error) => {
          console.error('❌ Error loading templates:', error);
          this.templates = [];
          this.isLoading = false;
          const msg = this.normalizeHttpError(error);
          alert('Failed to load templates. ' + msg);
        }
      });
    }, 100);
  }

  // ===== Card click → load questions =====
  viewQuestions(t: temp): void {
    this.selectedTemplate = t;
    const templateId = t.templateId || (t as any).id || (t as any).template_id;
    if (!templateId) {
      alert('Template ID is missing');
      console.log('Template object:', t);
      return;
    }

    this.showQuestionsPanel = true;
    this.questionLoading = true;
    this.activeTemplateName = t.templateName || (t as any).template_name || '';

    this.templateService.getQuestionsByTemplateId(templateId, 100).subscribe({
      next: (qs) => {
        this.questions = qs || [];
        this.questionLoading = false;
        console.log('Questions loaded:', this.questions);
      },
      error: (error) => {
        console.error('Error loading questions:', error);
        const msg = this.normalizeHttpError(error);
        this.questions = [];
        this.questionLoading = false;
        alert('Failed to load questions. ' + msg);
      }
    });
  }

  // ===== Add one question =====
  addQuestion(): void {
    if (!this.selectedTemplate) {
      alert('Select a template first');
      return;
    }
    const templateId = this.selectedTemplate.templateId || (this.selectedTemplate as any).id || (this.selectedTemplate as any).template_id;
    const text = (this.newQuestionText || '').trim();

    if (!templateId) {
      alert('Template ID is missing');
      return;
    }
    if (!text) {
      alert('Enter a question');
      return;
    }

    this.templateService.addQuestion(templateId, text).subscribe({
      next: (_) => {
        this.newQuestionText = '';
        this.viewQuestions(this.selectedTemplate!);
      },
      error: (error) => {
        console.error('Error adding question:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to add question. ' + msg);
      }
    });
  }

  // ===== Edit question =====
  editQuestion(question: Question): void {
    console.log('✏️ Edit question called:', question);
    const newText = prompt('Edit question:', question.text || (question as any).question_text || '');
    if (newText === null || newText.trim() === '') {
      console.log('⚠️ Edit cancelled by user');
      return;
    }

    const questionId = question.questionId || (question as any).id || (question as any).question_id;
    const templateId = this.selectedTemplate?.templateId || (this.selectedTemplate as any)?.id || (this.selectedTemplate as any)?.template_id;
    
    if (!questionId) {
      alert('Question ID is missing');
      console.error('❌ Question ID not found. Object:', question);
      return;
    }

    console.log('🔄 Sending update request for question ID:', questionId, 'template ID:', templateId, 'with text:', newText);
    this.templateService.updateQuestion(questionId, newText, templateId).subscribe({
      next: (_) => {
        console.log('✅ Question updated successfully!');
        alert('Question updated!');
        if (this.selectedTemplate) this.viewQuestions(this.selectedTemplate);
      },
      error: (error) => {
        console.error('❌ Error updating question:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to update question. ' + msg);
      }
    });
  }

  // ===== Delete question =====
  deleteQuestion(question: Question): void {
    console.log('🗑️ Delete question called:', question);
    const questionId = question.questionId || (question as any).id || (question as any).question_id;
    const templateId = this.selectedTemplate?.templateId || (this.selectedTemplate as any)?.id || (this.selectedTemplate as any)?.template_id;
    
    if (!questionId) {
      alert('Question ID is missing');
      console.error('❌ Question ID not found. Object:', question);
      return;
    }
    if (!confirm('Are you sure you want to delete this question?')) {
      console.log('⚠️ Delete cancelled by user');
      return;
    }

    console.log('🔄 Sending delete request for question ID:', questionId, 'template ID:', templateId);
    this.templateService.deleteQuestion(questionId, templateId).subscribe({
      next: (_) => {
        console.log('✅ Question deleted successfully!');
        alert('Question deleted!');
        if (this.selectedTemplate) this.viewQuestions(this.selectedTemplate);
      },
      error: (error) => {
        console.error('❌ Error deleting question:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to delete question. ' + msg);
      }
    });
  }

  closeQuestionsPanel(): void {
    this.showQuestionsPanel = false;
    this.questions = [];
    this.activeTemplateName = '';
  }

  openModal(type: 'template' = 'template'): void {
    if (type === 'template') {
      this.showModal = true;
      this.isEditing = false;
      this.newTemplate = {
        templateName: '',
        templateType: 'PDF',
        templateConfig: '',
        createdBy: 1
      };
    }
  }

  editTemplate(template: temp): void {
    this.showModal = true;
    this.isEditing = true;
    this.newTemplate = { ...template };
    this.selectedTemplate = template;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedTemplate = null;
    this.newTemplate = {
      templateName: '',
      templateType: 'PDF',
      templateConfig: '',
      createdBy: 1
    };
    this.isEditing = false;
    this.isSubmitting = false;
  }

  // CREATE - Add new template
  addTemplate(): void {
    if (!this.newTemplate.templateName || !this.newTemplate.templateName.trim()) {
      alert('Template name is required');
      return;
    }
    this.isSubmitting = true;

    const templateData: temp = {
      templateName: this.newTemplate.templateName.trim(),
      templateType: this.newTemplate.templateType || 'PDF',
      templateConfig: this.newTemplate.templateConfig?.trim() || '',
      createdBy: Number(this.newTemplate.createdBy || 1)
    };

    console.log('Creating template:', templateData);

    this.templateService.createTemplate(templateData).subscribe({
      next: (response: any) => {
        console.log('✅ Template created successfully:', response);
        alert('Template created successfully!');
        this.closeModal();
        this.loadTemplates();
      },
      error: (error: any) => {
        console.error('❌ Error creating template:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to create template: ' + msg);
        this.isSubmitting = false;
      }
    });
  }

  // UPDATE
  saveTemplate(): void {
    if (!this.newTemplate.templateName?.trim()) {
      alert('Template name is required');
      return;
    }

    const templateId = this.newTemplate.templateId || (this.newTemplate as any).id;
    if (!templateId) {
      alert('Template ID is missing');
      return;
    }

    console.log('Updating template:', this.newTemplate);
    this.isSubmitting = true;
    this.templateService.updateTemplate(templateId, this.newTemplate).subscribe({
      next: (response: any) => {
        console.log('Template updated successfully:', response);
        alert('Template updated successfully!');
        this.loadTemplates();
        this.closeModal();
      },
      error: (error: any) => {
        console.error('Error updating template:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to update template. ' + msg);
        this.isSubmitting = false;
      }
    });
  }

  deleteTemplate(template: temp): void {
    const templateId = template.templateId || (template as any).id;
    if (!templateId) {
      alert('Cannot delete template without ID');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${template.templateName}"?`)) return;

    console.log('Deleting template:', templateId);
    this.templateService.deleteTemplate(templateId).subscribe({
      next: (_: any) => {
        console.log('Template deleted successfully');
        alert('Template deleted successfully!');
        this.loadTemplates();
      },
      error: (error: any) => {
        console.error('Error deleting template:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to delete template. ' + msg);
      }
    });
  }

  submitForm(): void {
    if (this.isEditing) {
      this.saveTemplate();
    } else {
      this.addTemplate();
    }
  }

  // —— Utility: Convert Angular HttpErrorResponse into readable text
  private normalizeHttpError(error: any): string {
    // Angular status 0 => CORS/preflight/network
    if (error && error.status === 0) {
      return 'Network/CORS issue (status 0). Check backend URL, CORS origins, and HTTPS/HTTP match.';
    }
    const apiMsg = error?.error?.message || error?.error?.title || error?.message;
    const statusText = error?.status ? ` [${error.status}]` : '';
    return (apiMsg || 'Unknown error') + statusText;
  }
}