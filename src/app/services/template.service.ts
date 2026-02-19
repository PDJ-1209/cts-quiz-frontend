// src/app/Service/template.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { temp } from '../models/temp';
import { Question } from '../models/question';

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private apiUrl = `${environment.apiUrl}${environment.apiEndpoints.template}`;
  private apiUrlQuestions = `${environment.apiUrl}${environment.apiEndpoints.questions}`;

  constructor(private http: HttpClient) {}

  private jsonHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  });

  getAllTemplates(): Observable<temp[]> {
    return this.http.get<temp[]>(this.apiUrl, { headers: this.jsonHeaders });
  }

  getTemplateById(id: number): Observable<temp> {
    return this.http.get<temp>(`${this.apiUrl}/${id}`, { headers: this.jsonHeaders });
  }

  createTemplate(template: temp): Observable<temp> {
    // sanitize payload
    const payload: temp = {
      templateName: (template.templateName || '').trim(),
      templateType: template.templateType || 'PDF',
      templateConfig: (template.templateConfig || '').trim(),
      createdBy: Number(template.createdBy || 1)
    };

    return this.http.post<temp>(this.apiUrl, payload, {
      headers: this.jsonHeaders
      // withCredentials: true  // only if backend expects cookies + CORS .AllowCredentials()
    });
  }

  updateTemplate(id: number, template: temp): Observable<temp> {
    return this.http.put<temp>(`${this.apiUrl}/${id}`, template, { headers: this.jsonHeaders });
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.jsonHeaders });
  }

  // ===== Questions =====
  getQuestionsByTemplateId(id: number, limit = 10): Observable<Question[]> {
    return this.http.get<Question[]>(`${this.apiUrl}/${id}/questions`, {
      headers: this.jsonHeaders,
      params: { limit } as any
    });
  }

  addQuestion(templateId: number, text: string): Observable<{ id: number; text: string; templateId: number }> {
    const body = { text: (text || '').trim() };
    return this.http.post<{ id: number; text: string; templateId: number }>(
      `${this.apiUrl}/${templateId}/questions`,
      body,
      { headers: this.jsonHeaders }
    );
  }

  updateQuestion(questionId: number, text: string, templateId?: number): Observable<any> {
    // Use nested endpoint to match backend: /api/Template/{templateId}/questions/{questionId}
    let url: string;
    if (templateId) {
      url = `${this.apiUrl}/${templateId}/questions/${questionId}`;
    } else {
      url = `${this.apiUrlQuestions}/${questionId}`;
    }
    
    // Send text in the body - try different property names the backend might expect
    // Backend might expect: { text }, { questionText }, { question_text }, or just the string
    const body = { 
      text: (text || '').trim()
    };
    
    console.log('📤 PUT Request URL:', url);
    console.log('📤 PUT Request Body:', JSON.stringify(body));
    
    return this.http.put<any>(
      url,
      body,
      { headers: this.jsonHeaders }
    ).pipe(
      tap((response) => {
        console.log('✅ PUT Success Response:', response);
      }),
      catchError((error) => {
        console.error('❌ PUT Error Status:', error.status);
        console.error('❌ PUT Error Message:', error.error?.message || error.statusText);
        console.error('❌ Full Error Response:', error.error);
        throw error;
      })
    );
  }

  deleteQuestion(questionId: number, templateId?: number): Observable<void> {
    // Use nested endpoint to match backend: /api/Template/questions/{qid}
    const url = `${this.apiUrl}/questions/${questionId}`;
    console.log('📤 DELETE Request:', url);
    
    return this.http.delete<void>(url, { headers: this.jsonHeaders });
  }

  // Category-based template methods
  getQuestionCountByCategory(category: string): Observable<any> {
    const url = `${environment.apiUrl}/Host/Question/category/${category}/count`;
    return this.http.get<any>(url, { headers: this.jsonHeaders });
  }

  getAvailableCategories(): Observable<string[]> {
    const url = `${environment.apiUrl}/Host/Question/categories`;
    return this.http.get<string[]>(url, { headers: this.jsonHeaders });
  }

  getTagsByCategory(category: string): Observable<string[]> {
    const url = `${environment.apiUrl}/Host/Question/category/${category}/tags`;
    return this.http.get<string[]>(url, { headers: this.jsonHeaders });
  }

  getRandomQuestionsByCategory(request: any): Observable<Question[]> {
    const url = `${environment.apiUrl}/Host/Question/random`;
    return this.http.post<Question[]>(url, request, { headers: this.jsonHeaders });
  }

  getQuestionsByCategory(category: string, limit: number = 15): Observable<Question[]> {
    const url = `${environment.apiUrl}/Host/Question/category/${encodeURIComponent(category)}/questions`;
    return this.http.get<Question[]>(url, { 
      headers: this.jsonHeaders,
      params: { limit } as any
    });
  }
}
