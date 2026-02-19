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

    // Check if this is a category template (templateType === 'CATEGORY')
    if (t.templateType === 'CATEGORY') {
      // Parse the config to get the category and question count
      try {
        const config = JSON.parse(t.templateConfig || '{}');
        const category = config.category;
        const questionCount = config.questionCount || 15;
        
        if (category) {
          console.log(`Loading category template: ${category} with ${questionCount} questions`);
          this.templateService.getQuestionsByCategory(category, questionCount).subscribe({
            next: (qs: Question[]) => {
              this.questions = qs || [];
              this.questionLoading = false;
              console.log(`✅ Loaded ${this.questions.length} questions for category ${category}`);
            },
            error: (error: any) => {
              console.error('Error loading category questions:', error);
              const msg = this.normalizeHttpError(error);
              this.questions = [];
              this.questionLoading = false;
              alert('Failed to load questions. ' + msg);
            }
          });
          return;
        }
      } catch (error) {
        console.error('Error parsing template config:', error);
      }
    }

    // Fall back to loading by template ID for non-category templates
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

  openModal(type: 'category' = 'category'): void {
    if (type === 'category') {
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
        templateName: `${this.selectedCategory} Quiz Template - ${new Date().toLocaleDateString()}`,
        templateType: 'CATEGORY',
        templateConfig: JSON.stringify({
          category: this.selectedCategory,
          questionCount: this.requestedQuestionCount,
          autoGenerated: true,
          createdAt: new Date().toISOString()
        }),
        createdBy: this.currentUserId || 1
      };

      // Create the template in database
      const created = await this.templateService.createTemplate(categoryTemplate).toPromise();
      console.log('✅ Category template created:', created);
      
      // Fetch questions by category (Tags) from backend
      const questions = await this.templateService.getQuestionsByCategory(this.selectedCategory, this.requestedQuestionCount).toPromise();
      console.log(`✅ Fetched ${questions?.length || 0} questions for ${this.selectedCategory}`, questions);
      
      // Close modal and show questions
      this.showModal = false;
      this.showQuestionsPanel = true;
      this.questions = questions || [];
      this.activeTemplateName = categoryTemplate.templateName;
      this.selectedTemplate = created || null;
      
    } catch (error) {
      console.error('❌ Error creating category template:', error);
      alert('Failed to create template: ' + this.normalizeHttpError(error));
    } finally {
      this.isSubmitting = false;
    }
  }

  editTemplate(template: temp): void {
    // Edit existing template if needed in future
    alert('Edit functionality not available for category templates');
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
  // (Functionality removed - only category templates are supported)

  // UPDATE
  // (Functionality removed - only category templates are supported)

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