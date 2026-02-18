import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAtUtc: Date;
  updatedAtUtc: Date;
  employeeRoles: EmployeeRole[];
  department?: string;
  lastLogin?: Date;
}

export interface EmployeeRole {
  roleId: number;
  roleName: string;
}

export interface Role {
  roleId: number;
  roleName: string;
  description?: string;
}

export interface Template {
  id: number;
  templateName: string;
  templateType: string;
  templateConfig?: any;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateTemplateRequest {
  templateName: string;
  templateType: string;
  templateConfig?: any;
  createdBy: string;
}

export interface UpdateTemplateRequest {
  templateName: string;
  templateType: string;
  templateConfig?: any;
  createdBy: string;
}

export interface AssignRoleRequest {
  employeeId: string;
  roleId: number;
}

export interface AdminStats {
  totalUsers: number;
  activeHosts: number;
  totalQuizzes: number;
  activeSessions: number;
  templatesCount: number;
  lastUpdated: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;
  private adminApiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // ============= USER MANAGEMENT =============

  /**
   * Get all users in the system
   */
  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.apiUrl}/UserManagement`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching users:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): Observable<AdminUser> {
    return this.http.get<AdminUser>(`${this.apiUrl}/UserManagement/${id}`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching user:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Update user status (activate/deactivate)
   */
  updateUserStatus(employeeId: string, isActive: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/UserManagement/${employeeId}/status`, { isActive })
      .pipe(
        catchError(error => {
          console.error('AdminService: Error updating user status:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Assign role to user
   */
  assignRole(request: AssignRoleRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/UserManagement/assign-role`, request)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error assigning role:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Remove role from user
   */
  removeRole(employeeId: string, roleId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/UserManagement/${employeeId}/roles/${roleId}`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error removing role:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Change user's primary role (remove all roles and assign new one)
   */
  changeUserRole(employeeId: string, newRoleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/UserManagement/${employeeId}/change-role`, { roleId: newRoleId })
      .pipe(
        catchError(error => {
          console.error('AdminService: Error changing user role:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= ROLE MANAGEMENT =============

  /**
   * Get all available roles
   */
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/UserManagement/roles`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching roles:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= TEMPLATE MANAGEMENT =============

  /**
   * Get all templates
   */
  getTemplates(): Observable<Template[]> {
    return this.http.get<Template[]>(`${this.apiUrl}/Template`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching templates:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get template by ID
   */
  getTemplateById(id: number): Observable<Template> {
    return this.http.get<Template>(`${this.apiUrl}/Template/${id}`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching template:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Create new template
   */
  createTemplate(template: CreateTemplateRequest): Observable<Template> {
    return this.http.post<Template>(`${this.apiUrl}/Template`, template)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error creating template:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Update template
   */
  updateTemplate(id: number, template: UpdateTemplateRequest): Observable<Template> {
    return this.http.put<Template>(`${this.apiUrl}/Template/${id}`, template)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error updating template:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Delete template
   */
  deleteTemplate(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Template/${id}`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error deleting template:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= ADMIN STATISTICS =============

  /**
   * Get admin dashboard statistics
   */
  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.apiUrl}/Metrics`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching admin stats:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get recent system activity
   */
  getRecentActivity(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/Metrics/recent-activity`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching recent activity:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= HELPER METHODS =============

  /**
   * Get role display name with proper formatting
   */
  getRoleDisplayName(role: string): string {
    const roleMap: { [key: string]: string } = {
      'admin': 'Administrator',
      'host': 'Quiz Host',
      'participant': 'Participant',
      'viewer': 'Viewer'
    };

    return roleMap[role.toLowerCase()] || role;
  }

  /**
   * Get role icon class
   */
  getRoleIcon(role: string): string {
    const iconMap: { [key: string]: string } = {
      'admin': 'fas fa-crown',
      'host': 'fas fa-user-tie',
      'participant': 'fas fa-user',
      'viewer': 'fas fa-eye'
    };

    return iconMap[role.toLowerCase()] || 'fas fa-user';
  }

  /**
   * Get role CSS class
   */
  getRoleClass(role: string): string {
    const classMap: { [key: string]: string } = {
      'admin': 'badge-admin',
      'host': 'badge-host',
      'participant': 'badge-participant',
      'viewer': 'badge-viewer'
    };

    return classMap[role.toLowerCase()] || 'badge-default';
  }

  /**
   * Format user name for display
   */
  formatUserName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string | undefined): string {
    if (!date) return 'Never';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  }

  // ============= QUIZ MANAGEMENT =============

  /**
   * Get all quizzes in the system
   */
  getQuizzes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/QuizManagement/quizzes`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching quizzes:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all surveys in the system
   */
  getSurveys(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/QuizManagement/surveys`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching surveys:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all polls in the system
   */
  getPolls(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/QuizManagement/polls`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching polls:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get quiz management dashboard data
   */
  getQuizManagementDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/QuizManagement/dashboard`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching quiz management dashboard:', error);
          return throwError(() => error);
        })
      );
  }

  // ============= REPORTS ANALYTICS =============

  /**
   * Get reports analytics data
   */
  getReportsAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/QuizManagement/analytics`)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching reports analytics:', error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Get feedback analytics
   */
  getFeedbackAnalytics(quizId?: number): Observable<any> {
    const url = quizId 
      ? `${this.apiUrl}/Feedback/analytics/${quizId}`
      : `${this.apiUrl}/Feedback/analytics`;
    return this.http.get<any>(url)
      .pipe(
        catchError(error => {
          console.error('AdminService: Error fetching feedback analytics:', error);
          return throwError(() => error);
        })
      );
  }
}