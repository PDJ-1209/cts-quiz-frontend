// src/app/template/template.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { temp } from '../../models/temp';
import { Question, Option } from '../../models/question';
import { TemplateService, TemplateWithQuestionsResponse, RenderedQuestion } from '../../services/template.service';

@Component({
  selector: 'app-template',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [TemplateService],
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.css']
})
export class TemplateComponent implements OnInit {

  showModal = false;
  isEditing = false;
  isLoading = true;
  isSubmitting = false;
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
    'Node.js', 'Spring Boot', 'Database', 'DevOps', 'General',
    'Others (Blank Template)'
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

  // ===== Template Editor State =====
  isEditorMode = false;
  editorTemplate: temp | null = null;
  editorQuestions: Question[] = [];
  editorMeta = {
    name: '',
    category: '',
    tags: '',
    templateType: 'CATEGORY',
    visibility: 'private'
  };
  editorDirty = false;
  editorSaving = false;
  editorLoading = false;
  validationErrors: string[] = [];
  toast: { type: 'success' | 'error' | 'warning'; message: string } | null = null;
  questionTypes = ['MCQ', 'Single', 'Multiple', 'TrueFalse', 'ShortAnswer'];
  isNewTemplate = false; // Track if this is an unsaved draft

  constructor(
    private templateService: TemplateService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadTemplates();
    this.loadCategories();
    
    // Check for query params - open specific template in editor
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.openTemplateById(+params['id']);
      }
    });
  }

  private openTemplateById(templateId: number): void {
    // Wait for templates to load, then open the editor
    const checkAndOpen = () => {
      if (!this.isLoading) {
        const template = this.templates.find(t => t.templateId === templateId);
        if (template) {
          this.openEditorForTemplate(template);
        } else {
          // Template not in list, try to fetch it directly
          this.templateService.getTemplateById(templateId).subscribe({
            next: (t: temp) => {
              if (t) {
                this.openEditorForTemplate(t);
              }
            },
            error: (err: any) => {
              console.error('Template not found:', err);
              this.showToast('error', 'Template not found');
            }
          });
        }
      } else {
        setTimeout(checkAndOpen, 100);
      }
    };
    checkAndOpen();
  }

  private async loadCategories(): Promise<void> {
    try {
      const categories = await this.templateService.getAvailableCategories().toPromise();
      if (categories && categories.length > 0) {
        // Set categories from backend, then always add "Others (Blank Template)" at the end
        this.templateCategories = [...categories, 'Others (Blank Template)'];
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // Keep default categories if backend fails (already includes "Others")
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

  // ===== Card click → open Template Editor =====
  viewQuestions(t: temp): void {
    this.selectedTemplate = t;
    const templateId = t.templateId;
    if (!templateId) {
      alert('Template ID is missing');
      console.log('Template object:', t);
      return;
    }

    // Open the full Template Editor
    this.openEditorForTemplate(t);
  }

  // ===== Add one question (legacy - questions panel) =====
  addQuestionLegacy(): void {
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
    // If "Others" is selected, skip fetching - user will create blank template
    if (category === 'Others (Blank Template)') {
      this.availableQuestions = 0;
      return;
    }

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

  // Create blank template (for "Others" category)
  createBlankTemplate(): void {
    // Auto-generate template name
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB');
    const templateName = `New Template - ${dateStr}`;

    // Create draft template (not saved to DB yet)
    this.editorTemplate = {
      templateName: templateName,
      templateType: 'CATEGORY',
      templateConfig: JSON.stringify({
        category: 'Custom',
        questionCount: 0,
        autoGenerated: false
      }),
      createdBy: this.currentUserId || 1
    };

    // Start with empty questions array
    this.editorQuestions = [];

    // Populate editor metadata
    this.editorMeta = {
      name: templateName,
      category: '',
      tags: '',
      templateType: 'CATEGORY',
      visibility: 'private'
    };

    // Switch to editor mode
    this.isNewTemplate = true;
    this.editorDirty = true; // New template is always dirty
    this.isEditorMode = true;
    this.showModal = false;
    this.selectedCategory = '';
    this.validateEditor();
  }

  async createCategoryTemplate(): Promise<void> {
    if (!this.selectedCategory || this.requestedQuestionCount <= 0) {
      alert('Please select a category and valid question count');
      return;
    }

    if (this.requestedQuestionCount > this.availableQuestions) {
      const proceed = confirm(`Only ${this.availableQuestions} questions available for ${this.selectedCategory}. Do you want to proceed with ${this.availableQuestions} questions?`);
      if (!proceed) return;
      this.requestedQuestionCount = this.availableQuestions;
    }

    this.isSubmitting = true;

    try {
      // Fetch questions by category from backend
      const questions = await this.templateService.getQuestionsByCategory(this.selectedCategory, this.requestedQuestionCount).toPromise();
      console.log(`✅ Fetched ${questions?.length || 0} questions for ${this.selectedCategory}`, questions);

      if (!questions || questions.length === 0) {
        this.showToast('warning', `No questions available for ${this.selectedCategory}. Please add questions first.`);
        this.isSubmitting = false;
        return;
      }

      // Auto-generate template name
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-GB');
      const templateName = `${this.selectedCategory} Quiz Template - ${dateStr}`;

      // Create draft template (not saved to DB yet)
      this.editorTemplate = {
        templateName: templateName,
        templateType: 'CATEGORY',
        templateConfig: JSON.stringify({
          category: this.selectedCategory,
          questionCount: questions.length,
          autoGenerated: true
        }),
        createdBy: this.currentUserId || 1
      };

      // Normalize questions with order and defaults
      this.editorQuestions = this.normalizeQuestions(questions);

      // Populate editor metadata
      this.editorMeta = {
        name: templateName,
        category: this.selectedCategory,
        tags: '',
        templateType: 'CATEGORY',
        visibility: 'private'
      };

      // Switch to editor mode
      this.isNewTemplate = true;
      this.editorDirty = true; // New template is always dirty
      this.isEditorMode = true;
      this.showModal = false;
      this.validateEditor();

    } catch (error) {
      console.error('❌ Error fetching questions:', error);
      this.showToast('error', 'Failed to fetch questions: ' + this.normalizeHttpError(error));
    } finally {
      this.isSubmitting = false;
    }
  }

  // ===== Template Editor Methods =====

  openEditorForTemplate(template: temp): void {
    this.editorLoading = true;
    this.isEditorMode = true;
    this.isNewTemplate = false;
    this.editorTemplate = template;

    // Load template with rendered questions from template_config JSON
    const templateId = template.templateId;
    if (templateId) {
      this.templateService.getTemplateWithRenderedQuestions(templateId).subscribe({
        next: (response: TemplateWithQuestionsResponse) => {
          console.log('✅ Loaded template with rendered questions:', response);
          
          // Parse config from response
          const config = response.config || {};

          this.editorMeta = {
            name: response.templateName,
            category: config.category || '',
            tags: Array.isArray(config.tags) ? config.tags.join(', ') : '',
            templateType: response.templateType || 'CATEGORY',
            visibility: config.visibility || 'private'
          };

          // Convert rendered questions to editor format
          this.editorQuestions = this.convertRenderedToEditorQuestions(response.questions || []);
          this.editorDirty = false;
          this.editorLoading = false;
          this.validateEditor();
        },
        error: (err) => {
          console.error('Error loading template with questions:', err);
          // Fallback to old method if new endpoint fails
          this.loadQuestionsLegacy(template);
        }
      });
    } else {
      this.editorQuestions = [];
      this.editorLoading = false;
    }
  }

  // Fallback method for loading questions (legacy)
  private loadQuestionsLegacy(template: temp): void {
    const config = this.parseConfig(template.templateConfig);

    this.editorMeta = {
      name: template.templateName,
      category: config.category || '',
      tags: Array.isArray(config.tags) ? config.tags.join(', ') : (config.tags || ''),
      templateType: template.templateType,
      visibility: config.visibility || 'private'
    };

    const templateId = template.templateId;
    if (templateId) {
      this.templateService.getQuestionsByTemplateId(templateId, 200).subscribe({
        next: (qs) => {
          this.editorQuestions = this.normalizeQuestions(qs || []);
          this.editorDirty = false;
          this.editorLoading = false;
          this.validateEditor();
        },
        error: (err) => {
          console.error('Error loading questions:', err);
          this.editorQuestions = [];
          this.editorLoading = false;
          this.showToast('error', 'Failed to load questions');
        }
      });
    } else {
      this.editorQuestions = [];
      this.editorLoading = false;
    }
  }

  // Convert rendered questions from API to editor format
  private convertRenderedToEditorQuestions(rendered: RenderedQuestion[]): Question[] {
    return rendered.map((rq, idx) => ({
      questionId: rq.questionId,
      questionText: rq.questionText || '',
      questionType: rq.questionType || 'MCQ',
      category: rq.category,
      order: rq.order ?? idx + 1,
      points: rq.points ?? 1,
      isRequired: rq.isRequired ?? true,
      timerSeconds: rq.timerSec,
      options: (rq.options || []).map((opt, oi) => ({
        optionId: opt.optionId,
        optionText: opt.optionText || '',
        isCorrect: opt.isCorrect,
        order: opt.order ?? oi + 1
      }))
    }));
  }

  private normalizeQuestions(qs: Question[]): Question[] {
    return (qs || []).map((q, idx) => ({
      ...q,
      order: q.order ?? idx + 1,
      points: q.points ?? 1,
      isRequired: q.isRequired ?? true,
      questionType: q.questionType || 'MCQ',
      options: (q.options || []).map((o, oi) => ({
        ...o,
        isCorrect: !!o.isCorrect,
        order: o.order ?? oi + 1
      }))
    }));
  }

  private parseConfig(config: any): any {
    if (!config) return {};
    if (typeof config === 'string') {
      try { return JSON.parse(config); } catch { return {}; }
    }
    return config;
  }

  // Helper to get a specific value from template config (for display in cards)
  getConfigValue(template: temp, key: string): any {
    const config = this.parseConfig(template.templateConfig);
    return config[key] ?? null;
  }

  closeEditor(): void {
    if (this.editorDirty) {
      const leave = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!leave) return;
    }
    this.isEditorMode = false;
    this.editorTemplate = null;
    this.editorQuestions = [];
    this.editorDirty = false;
    this.isNewTemplate = false;
    this.validationErrors = [];
  }

  markDirty(): void {
    this.editorDirty = true;
    this.validateEditor();
  }

  // ===== Question CRUD =====

  addQuestion(position: 'top' | 'bottom' = 'bottom'): void {
    const newQ: Question = {
      questionText: '',
      questionType: 'MCQ',
      order: position === 'top' ? 1 : this.editorQuestions.length + 1,
      isRequired: true,
      points: 1,
      options: [
        { optionText: '', isCorrect: true, order: 1 },
        { optionText: '', isCorrect: false, order: 2 }
      ]
    };

    if (position === 'top') {
      this.editorQuestions = [newQ, ...this.editorQuestions];
    } else {
      this.editorQuestions = [...this.editorQuestions, newQ];
    }
    this.reorderQuestions();
    this.markDirty();
  }

  deleteQuestionFromEditor(question: Question): void {
    if (!confirm('Delete this question?')) return;
    this.editorQuestions = this.editorQuestions.filter(q => q !== question);
    this.reorderQuestions();
    this.markDirty();
  }

  moveQuestion(question: Question, direction: 'up' | 'down'): void {
    const idx = this.editorQuestions.indexOf(question);
    if (idx === -1) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= this.editorQuestions.length) return;
    [this.editorQuestions[idx], this.editorQuestions[swapWith]] = 
      [this.editorQuestions[swapWith], this.editorQuestions[idx]];
    this.reorderQuestions();
    this.markDirty();
  }

  private reorderQuestions(): void {
    this.editorQuestions.forEach((q, idx) => q.order = idx + 1);
  }

  onQuestionTypeChange(question: Question): void {
    const needsOptions = this.isOptionBasedType(question.questionType);
    if (needsOptions && (!question.options || question.options.length < 2)) {
      question.options = [
        { optionText: '', isCorrect: true, order: 1 },
        { optionText: '', isCorrect: false, order: 2 }
      ];
    } else if (!needsOptions) {
      question.options = [];
    }
    this.markDirty();
  }

  isOptionBasedType(type?: string): boolean {
    const t = (type || '').toLowerCase();
    return ['mcq', 'single', 'multiple', 'truefalse'].includes(t);
  }

  isSingleCorrectType(type?: string): boolean {
    const t = (type || '').toLowerCase();
    return ['single', 'mcq'].includes(t);
  }

  // ===== Option CRUD =====

  addOptionToQuestion(question: Question): void {
    if (!question.options) question.options = [];
    question.options.push({
      optionText: '',
      isCorrect: false,
      order: question.options.length + 1
    });
    this.markDirty();
  }

  deleteOptionFromQuestion(question: Question, option: Option): void {
    if (!question.options) return;
    if (question.options.length <= 2 && this.isOptionBasedType(question.questionType)) {
      this.showToast('warning', 'Option-based questions must have at least 2 options');
      return;
    }
    if (!confirm('Delete this option?')) return;
    question.options = question.options.filter(o => o !== option);
    question.options.forEach((o, i) => o.order = i + 1);
    this.markDirty();
  }

  onOptionCorrectToggle(question: Question, option: Option): void {
    if (this.isSingleCorrectType(question.questionType)) {
      // For single-correct, uncheck all others
      question.options?.forEach(o => o.isCorrect = (o === option));
    }
    this.markDirty();
  }

  // ===== Validation =====

  validateEditor(): boolean {
    const errors: string[] = [];

    if (!this.editorMeta.name.trim()) {
      errors.push('Template name is required.');
    }

    this.editorQuestions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (!q.questionText || !q.questionText.trim()) {
        errors.push(`Question ${qNum}: Text is required.`);
      }

      if (this.isOptionBasedType(q.questionType)) {
        const options = q.options || [];
        if (options.length < 2) {
          errors.push(`Question ${qNum}: Must have at least 2 options.`);
        }

        const correctCount = options.filter(o => o.isCorrect).length;
        if (this.isSingleCorrectType(q.questionType)) {
          if (correctCount !== 1) {
            errors.push(`Question ${qNum}: Exactly 1 correct answer required.`);
          }
        } else {
          if (correctCount < 1) {
            errors.push(`Question ${qNum}: At least 1 correct answer required.`);
          }
        }

        options.forEach((o, oi) => {
          if (!o.optionText || !o.optionText.trim()) {
            errors.push(`Question ${qNum}, Option ${oi + 1}: Text is required.`);
          }
        });
      }
    });

    this.validationErrors = errors;
    return errors.length === 0;
  }

  canSave(): boolean {
    return this.editorDirty && !this.editorSaving && this.validationErrors.length === 0;
  }

  // ===== Save / Update Template =====

  async saveTemplate(): Promise<void> {
    if (!this.validateEditor()) {
      this.showToast('error', 'Fix validation errors before saving.');
      return;
    }

    this.editorSaving = true;

    // Build payload with question references
    // Questions with questionId are existing questions (referenced by ID)
    // Questions without questionId are new and will be created in DB
    const payload = {
      templateName: this.editorMeta.name.trim(),
      templateType: this.editorMeta.templateType,
      templateConfig: JSON.stringify({
        category: this.editorMeta.category,
        tags: this.editorMeta.tags ? this.editorMeta.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        visibility: this.editorMeta.visibility,
        questionCount: this.editorQuestions.length
      }),
      createdBy: this.currentUserId || 1,
      questions: this.editorQuestions.map((q, idx) => ({
        questionId: q.questionId, // Existing questions have ID, new ones are undefined/null
        questionText: (q.questionText || '').trim(),
        questionType: q.questionType || 'MCQ',
        isRequired: q.isRequired ?? true,
        points: q.points ?? 1,
        order: idx + 1,
        options: (q.options || []).map((o, oi) => ({
          optionId: o.optionId,
          optionText: (o.optionText || '').trim(),
          isCorrect: !!o.isCorrect,
          order: oi + 1
        }))
      }))
    };

    try {
      if (this.isNewTemplate) {
        // Create new template with question references stored in template_config JSON
        const created = await this.templateService.createTemplateWithQuestionRefs(payload).toPromise();
        console.log('✅ Template created with question refs:', created);
        this.editorTemplate = created || null;
        this.isNewTemplate = false;
        this.showToast('success', 'Template created successfully!');
      } else if (this.editorTemplate?.templateId) {
        // Update existing template with question references
        const updated = await this.templateService.updateTemplateWithQuestionRefs(
          this.editorTemplate.templateId, 
          payload
        ).toPromise();
        console.log('✅ Template updated with question refs:', updated);
        this.editorTemplate = updated || this.editorTemplate;
        this.showToast('success', 'Template updated successfully!');
      }

      this.editorDirty = false;
      this.loadTemplates(); // Refresh list

    } catch (error) {
      console.error('❌ Error saving template:', error);
      this.showToast('error', 'Failed to save template: ' + this.normalizeHttpError(error));
    } finally {
      this.editorSaving = false;
    }
  }

  // ===== Toast Helper =====

  private showToast(type: 'success' | 'error' | 'warning', message: string): void {
    this.toast = { type, message };
    setTimeout(() => this.toast = null, 4000);
  }

  editTemplate(template: temp): void {
    // Open Template Editor for editing
    this.openEditorForTemplate(template);
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