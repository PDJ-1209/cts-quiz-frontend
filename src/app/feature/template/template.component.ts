// src/app/template/template.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { temp } from '../../models/temp';
import { Question } from '../../models/question';
import { TemplateService } from '../../services/template.service';

@Component({
  selector: 'app-template',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [TemplateService],
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.css'] // 👈 plural
})
export class TemplateComponent implements OnInit {

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

  // Enhanced template properties
  templateCategories = [
    'Java', 'JavaScript', 'Python', 'React', 'Angular', 
    'Node.js', 'Spring Boot', 'Database', 'DevOps', 'General'
  ];
  
  selectedCategory = '';
  requestedQuestionCount = 15;
  availableQuestions = 0;
  showCategoryForm = false;
  
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
    this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    try {
      const categories = await this.templateService.getAvailableCategories().toPromise();
      if (categories && categories.length > 0) {
        this.templateCategories = categories;
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // Keep default categories if backend fails
    }
  }

  // READ - Load all templates
  loadTemplates(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.templateService.getAllTemplates().subscribe({
        next: (data: temp[]) => {
          console.log('✅ Templates loaded:', data);
          this.templates = data || [];
          this.isLoading = false;
        },
        error: (error: any) => {
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
    const templateId = t.templateId;
    if (!templateId) {
      alert('Template ID is missing');
      console.log('Template object:', t);
      return;
    }

    this.showQuestionsPanel = true;
    this.questionLoading = true;
    this.activeTemplateName = t.templateName;

    this.templateService.getQuestionsByTemplateId(templateId, 100).subscribe({
      next: (qs: Question[]) => {
        this.questions = qs || [];
        this.questionLoading = false;
        console.log('Questions loaded:', this.questions);
      },
      error: (error: any) => {
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
    const templateId = this.selectedTemplate.templateId;
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
      next: (_: any) => {
        this.newQuestionText = '';
        this.viewQuestions(this.selectedTemplate!);
      },
      error: (error: any) => {
        console.error('Error adding question:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to add question. ' + msg);
      }
    });
  }

  // ===== Edit question =====
  editQuestion(question: Question): void {
    console.log('✏️ Edit question called:', question);
    const newText = prompt('Edit question:', question.questionText || '');
    if (newText === null || newText.trim() === '') {
      console.log('⚠️ Edit cancelled by user');
      return;
    }

    const questionId = question.questionId;
    const templateId = this.selectedTemplate?.templateId;
    
    if (!questionId) {
      alert('Question ID is missing');
      console.error('❌ Question ID not found. Object:', question);
      return;
    }

    console.log('🔄 Sending update request for question ID:', questionId, 'template ID:', templateId, 'with text:', newText);
    this.templateService.updateQuestion(questionId, newText, templateId).subscribe({
      next: (_: any) => {
        console.log('✅ Question updated successfully!');
        alert('Question updated!');
        if (this.selectedTemplate) this.viewQuestions(this.selectedTemplate);
      },
      error: (error: any) => {
        console.error('❌ Error updating question:', error);
        const msg = this.normalizeHttpError(error);
        alert('Failed to update question. ' + msg);
      }
    });
  }

  // ===== Delete question =====
  deleteQuestion(question: Question): void {
    console.log('🗑️ Delete question called:', question);
    const questionId = question.questionId;
    const templateId = this.selectedTemplate?.templateId;
    
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
      next: (_: any) => {
        console.log('✅ Question deleted successfully!');
        alert('Question deleted!');
        if (this.selectedTemplate) this.viewQuestions(this.selectedTemplate);
      },
      error: (error: any) => {
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

  openModal(type: 'template' | 'category' = 'template'): void {
    if (type === 'template') {
      this.showModal = true;
      this.showCategoryForm = false;
      this.isEditing = false;
      this.newTemplate = {
        templateName: '',
        templateType: 'PDF',
        templateConfig: '',
        createdBy: 1
      };
    } else if (type === 'category') {
      this.showModal = true;
      this.showCategoryForm = true;
      this.selectedCategory = '';
      this.requestedQuestionCount = 15;
    }
  }

  openCategoryTemplate(category: string): void {
    this.selectedCategory = category;
    this.showCategoryForm = true;
    this.checkAvailableQuestions(category);
  }

  async checkAvailableQuestions(category: string): Promise<void> {
    try {
      // Connect to backend to get actual question count
      const response = await this.templateService.getQuestionCountByCategory(category).toPromise();
      this.availableQuestions = response?.availableQuestions || 0;
    } catch (error) {
      console.error('Error checking available questions:', error);
      // Fallback to mock data if backend is not available
      const mockCounts: { [key: string]: number } = {
        'Java': 150,
        'JavaScript': 120,
        'Python': 100,
        'React': 80,
        'Angular': 75,
        'Node.js': 60,
        'Spring Boot': 90,
        'Database': 110,
        'DevOps': 45,
        'General': 200
      };
      this.availableQuestions = mockCounts[category] || 0;
    }
  }

  async createCategoryTemplate(): Promise<void> {
    if (!this.selectedCategory || this.requestedQuestionCount <= 0) {
      alert('Please select a category and valid question count');
      return;
    }

    if (this.requestedQuestionCount > this.availableQuestions) {
      alert(`Only ${this.availableQuestions} questions available for ${this.selectedCategory}. Please adjust the count.`);
      return;
    }

    this.isSubmitting = true;

    try {
      // Create template with category configuration
      const categoryTemplate: temp = {
        templateName: `${this.selectedCategory} Quiz Template`,
        templateType: 'CATEGORY',
        templateConfig: JSON.stringify({
          category: this.selectedCategory,
          questionCount: this.requestedQuestionCount,
          autoGenerated: true,
          createdAt: new Date().toISOString()
        }),
        createdBy: this.currentUserId || 1
      };

      // Generate random questions for this category
      await this.generateRandomQuestions(categoryTemplate);
      
      this.showCategoryForm = false;
      this.showModal = false;
      this.loadTemplates(); // Refresh templates
      
    } catch (error) {
      console.error('Error creating category template:', error);
      alert('Failed to create template');
    } finally {
      this.isSubmitting = false;
    }
  }

  async generateRandomQuestions(template: temp): Promise<void> {
    try {
      // First create the template
      await this.templateService.createTemplate(template).toPromise();
      
      // Then generate random questions using backend API
      const questionRequest = {
        category: this.selectedCategory,
        questionCount: this.requestedQuestionCount,
        tags: '', // Could be expanded to support tag filtering
        difficulty: '' // Could be expanded to support difficulty filtering
      };

      const randomQuestions = await this.templateService.getRandomQuestionsByCategory(questionRequest).toPromise();
      console.log(`Generated ${randomQuestions?.length || 0} random questions for ${this.selectedCategory}`);
      
    } catch (error) {
      console.error('Error generating random questions:', error);
      throw error;
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
    this.showCategoryForm = false;
    this.selectedTemplate = null;
    this.newTemplate = {
      templateName: '',
      templateType: 'PDF',
      templateConfig: '',
      createdBy: 1
    };
    this.selectedCategory = '';
    this.requestedQuestionCount = 15;
    this.isEditing = false;
    this.isSubmitting = false;
  }

  resetForm(): void {
    this.newTemplate = {
      templateName: '',
      templateType: 'PDF',
      templateConfig: '',
      createdBy: 1
    };
    this.selectedCategory = '';
    this.requestedQuestionCount = 15;
    this.showCategoryForm = false;
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
  };    console.log('Creating template:', templateData);

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