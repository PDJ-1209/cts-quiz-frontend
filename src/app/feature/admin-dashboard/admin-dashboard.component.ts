import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/auth.models';
import { AdminService, AdminUser, Role, Template, AdminStats } from '../../services/admin.service';
import { AnalyticsComponent } from '../analytics/analytics.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, AnalyticsComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private router = inject(Router);
  
  currentUser = signal<User | null>(null);
  users = signal<AdminUser[]>([]);
  roles = signal<Role[]>([]);
  templates = signal<Template[]>([]);
  quizzes = signal<any[]>([]);
  surveys = signal<any[]>([]);
  polls = signal<any[]>([]);
  quizManagementData = signal<any>({});
  recentActivity = signal<any[]>([]);
  stats = signal<AdminStats>({
    totalUsers: 0,
    activeHosts: 0,
    totalQuizzes: 0,
    activeSessions: 0,
    templatesCount: 0,
    lastUpdated: new Date()
  });
  
  isLoading = signal(false);
  selectedTab = signal('overview');
  
  // Role management
  selectedUserId = signal<string | null>(null);
  selectedRoleId = signal<number | null>(null);
  showRoleModal = signal(false);
  
  // Template management
  selectedTemplate = signal<Template | null>(null);
  showTemplateModal = signal(false);
  templateFormData = signal({ name: '', type: 'PDF', config: '' });

  // Quiz management
  selectedQuizTab = signal('quizzes'); // quizzes, surveys, polls

  // Analytics signals
  isLoadingReports = signal(false);
  reportsAnalytics = signal<any>(null);
  feedbackAnalytics = signal<any>(null);

  ngOnInit() {
    this.loadCurrentUser();
    this.loadAdminData();
  }

  private async loadAdminData() {
    this.isLoading.set(true);
    try {
      // Load all admin data in parallel
      await Promise.all([
        this.loadUsers(),
        this.loadRoles(),
        this.loadTemplates(),
        this.loadQuizzes(),
        this.loadSurveys(),
        this.loadPolls(),
        this.loadQuizManagementDashboard(),
        this.loadStats(),
        this.loadRecentActivity()
      ]);
      
      // Load analytics data after initial data is loaded
      this.loadReportsAnalytics();
      this.loadFeedbackAnalytics();
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private loadCurrentUser() {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);
  }

  private async loadUsers(): Promise<void> {
    try {
      this.adminService.getUsers().subscribe({
        next: (users) => {
          console.log('[Admin] Users loaded:', users);
          this.users.set(users);
        },
        error: (error) => {
          console.error('[Admin] Error loading users:', error);
          // Fallback to mock data
          this.users.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  private async loadRoles(): Promise<void> {
    try {
      this.adminService.getRoles().subscribe({
        next: (roles) => {
          console.log('[Admin] Roles loaded:', roles);
          this.roles.set(roles);
        },
        error: (error) => {
          console.error('[Admin] Error loading roles:', error);
          this.roles.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      this.adminService.getTemplates().subscribe({
        next: (templates) => {
          console.log('[Admin] Templates loaded:', templates);
          this.templates.set(templates);
        },
        error: (error) => {
          console.error('[Admin] Error loading templates:', error);
          this.templates.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  private async loadQuizzes(): Promise<void> {
    try {
      this.adminService.getQuizzes().subscribe({
        next: (quizzes) => {
          console.log('[Admin] Quizzes loaded:', quizzes);
          this.quizzes.set(quizzes);
        },
        error: (error) => {
          console.error('[Admin] Error loading quizzes:', error);
          this.quizzes.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading quizzes:', error);
    }
  }

  private async loadSurveys(): Promise<void> {
    try {
      this.adminService.getSurveys().subscribe({
        next: (surveys) => {
          console.log('[Admin] Surveys loaded:', surveys);
          this.surveys.set(surveys);
        },
        error: (error) => {
          console.error('[Admin] Error loading surveys:', error);
          this.surveys.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading surveys:', error);
    }
  }

  private async loadPolls(): Promise<void> {
    try {
      this.adminService.getPolls().subscribe({
        next: (polls) => {
          console.log('[Admin] Polls loaded:', polls);
          this.polls.set(polls);
        },
        error: (error) => {
          console.error('[Admin] Error loading polls:', error);
          this.polls.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading polls:', error);
    }
  }

  private async loadQuizManagementDashboard(): Promise<void> {
    try {
      this.adminService.getQuizManagementDashboard().subscribe({
        next: (data) => {
          console.log('[Admin] Quiz management dashboard loaded:', data);
          this.quizManagementData.set(data);
        },
        error: (error) => {
          console.error('[Admin] Error loading quiz management dashboard:', error);
          this.quizManagementData.set({});
        }
      });
    } catch (error) {
      console.error('Error loading quiz management dashboard:', error);
    }
  }

  private async loadRecentActivity(): Promise<void> {
    try {
      this.adminService.getRecentActivity().subscribe({
        next: (activity) => {
          console.log('[Admin] Recent activity loaded:', activity);
          this.recentActivity.set(activity);
        },
        error: (error) => {
          console.error('[Admin] Error loading recent activity:', error);
          this.recentActivity.set([]);
        }
      });
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      this.adminService.getAdminStats().subscribe({
        next: (stats) => {
          console.log('[Admin] Stats loaded from backend:', stats);
          this.stats.set({
            totalUsers: stats.totalUsers || 0,
            activeHosts: stats.activeHosts || 0,
            totalQuizzes: stats.totalQuizzes || 0,
            activeSessions: stats.activeSessions || 0,
            templatesCount: stats.templatesCount || 0,
            lastUpdated: new Date(stats.lastUpdated || new Date())
          });
        },
        error: (error) => {
          console.error('[Admin] Error loading stats from backend:', error);
          // Calculate fallback stats from available data
          this.calculateFallbackStats();
        }
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      this.calculateFallbackStats();
    }
  }

  private calculateFallbackStats(): void {
    try {
      const users = this.users();
      const templates = this.templates();
      
      const totalUsers = users.length;
      const activeHosts = users.filter(u => 
        u.employeeRoles?.some(r => r.roleName?.toLowerCase() === 'host') && u.isActive
      ).length;
      
      console.log('[Admin] Using fallback stats calculation');
      this.stats.set({
        totalUsers,
        activeHosts,
        totalQuizzes: 0, // Will be updated when quiz data is available
        activeSessions: 0, // Will be updated when session data is available
        templatesCount: templates.length,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('[Admin] Error calculating fallback stats:', error);
      // Set default values if everything fails
      this.stats.set({
        totalUsers: 0,
        activeHosts: 0,
        totalQuizzes: 0,
        activeSessions: 0,
        templatesCount: 0,
        lastUpdated: new Date()
      });
    }
  }

  selectTab(tab: string) {
    this.selectedTab.set(tab);
  }

  selectQuizTab(tab: string) {
    this.selectedQuizTab.set(tab);
  }

  // Reports methods
  loadReportsAnalytics() {
    this.isLoadingReports.set(true);
    this.adminService.getReportsAnalytics().subscribe({
      next: (data) => {
        this.reportsAnalytics.set(data);
        this.isLoadingReports.set(false);
      },
      error: (error) => {
        console.error('Error loading reports analytics:', error);
        this.isLoadingReports.set(false);
      }
    });
  }

  loadFeedbackAnalytics() {
    this.adminService.getFeedbackAnalytics().subscribe({
      next: (data) => {
        this.feedbackAnalytics.set(data);
      },
      error: (error) => {
        console.error('Error loading feedback analytics:', error);
      }
    });
  }

  // Chart helper methods
  getBarHeight(value: number, data: any[]): number {
    const max = Math.max(...data.map(item => item.count));
    return max > 0 ? (value / max) * 100 : 0;
  }

  getPercentage(value: number, data: any[]): number {
    const max = Math.max(...data.map(item => item.quizCount));
    return max > 0 ? (value / max) * 100 : 0;
  }

  getEmojiPercentage(value: number, data: any[]): number {
    const max = Math.max(...data.map(item => item.count));
    return max > 0 ? (value / max) * 100 : 0;
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  }

  getCurrentMonthQuizzes(): number {
    const analytics = this.reportsAnalytics();
    if (!analytics?.quizzesByMonth) return 0;
    
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const currentMonthData = analytics.quizzesByMonth.find((item: any) => item.month === currentMonth);
    return currentMonthData?.count || 0;
  }

  getRecentQuizzes(): number {
    const analytics = this.reportsAnalytics();
    if (!analytics?.quizzesByMonth) return 0;
    
    // For simplicity, return the last month's count
    const lastMonth = analytics.quizzesByMonth[analytics.quizzesByMonth.length - 1];
    return lastMonth?.count || 0;
  }

  getSatisfactionLevel(): string {
    const feedback = this.feedbackAnalytics();
    if (!feedback?.averageRating) return 'N/A';
    
    const rating = feedback.averageRating;
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 3.5) return 'Good';
    if (rating >= 2.5) return 'Average';
    return 'Needs Improvement';
  }

  async updateUserRole(userId: string, newRole: string) {
    try {
      // TODO: Implement role update
      console.log(`Updating user ${userId} role to ${newRole}`);
      await this.loadUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  }

  // ============= ROLE MANAGEMENT METHODS =============
  
  openRoleAssignModal(userId: string) {
    this.selectedUserId.set(userId);
    // Pre-select current role
    const user = this.users().find(u => u.id === userId);
    if (user && user.employeeRoles && user.employeeRoles.length > 0) {
      this.selectedRoleId.set(user.employeeRoles[0].roleId);
    }
    this.showRoleModal.set(true);
  }

  closeRoleModal() {
    this.selectedUserId.set(null);
    this.selectedRoleId.set(null);
    this.showRoleModal.set(false);
  }

  async assignRole() {
    const userId = this.selectedUserId();
    const roleId = this.selectedRoleId();
    
    if (!userId || !roleId) {
      alert('Please select a role');
      return;
    }

    try {
      const user = this.users().find(u => u.id === userId);
      if (!user) return;

      // Use changeUserRole to replace current role with new one
      await this.adminService.changeUserRole(user.employeeId, roleId).toPromise();
      console.log(`[Admin] User ${userId} role changed to ${roleId}`);
      await this.loadUsers(); // Refresh users
      this.closeRoleModal();
      alert('User role changed successfully!');
    } catch (error) {
      console.error('[Admin] Error changing user role:', error);
      alert('Failed to change user role. Please try again.');
    }
  }

  async removeRole(userId: string, roleId: number) {
    if (!confirm('Are you sure you want to remove this role?')) return;
    
    try {
      await this.adminService.removeRole(userId, roleId).toPromise();
      console.log(`[Admin] Role ${roleId} removed from user ${userId}`);
      await this.loadUsers(); // Refresh users
    } catch (error) {
      console.error('[Admin] Error removing role:', error);
      alert('Failed to remove role. Please try again.');
    }
  }

  // ============= TEMPLATE MANAGEMENT METHODS =============

  openCreateTemplateModal() {
    this.selectedTemplate.set(null);
    this.templateFormData.set({ name: '', type: 'PDF', config: '' });
    this.showTemplateModal.set(true);
  }

  openEditTemplateModal(template: Template) {
    this.selectedTemplate.set(template);
    this.templateFormData.set({
      name: template.templateName,
      type: template.templateType,
      config: JSON.stringify(template.templateConfig || {}, null, 2)
    });
    this.showTemplateModal.set(true);
  }

  closeTemplateModal() {
    this.selectedTemplate.set(null);
    this.templateFormData.set({ name: '', type: 'PDF', config: '' });
    this.showTemplateModal.set(false);
  }

  async saveTemplate() {
    const formData = this.templateFormData();
    const template = this.selectedTemplate();
    
    if (!formData.name.trim()) {
      alert('Template name is required');
      return;
    }

    try {
      let config;
      try {
        config = formData.config ? JSON.parse(formData.config) : {};
      } catch (e) {
        alert('Invalid JSON configuration');
        return;
      }

      const templateData = {
        templateName: formData.name.trim(),
        templateType: formData.type,
        templateConfig: config,
        createdBy: this.currentUser()?.employeeId || 'admin'
      };

      if (template) {
        // Update existing template
        await this.adminService.updateTemplate(template.id, templateData).toPromise();
        console.log(`[Admin] Template ${template.id} updated`);
      } else {
        // Create new template
        await this.adminService.createTemplate(templateData).toPromise();
        console.log(`[Admin] New template created`);
      }

      await this.loadTemplates(); // Refresh templates
      this.closeTemplateModal();
    } catch (error) {
      console.error('[Admin] Error saving template:', error);
      alert('Failed to save template. Please try again.');
    }
  }

  async deleteTemplate(template: Template) {
    if (!confirm(`Are you sure you want to delete "${template.templateName}"?`)) return;
    
    try {
      await this.adminService.deleteTemplate(template.id).toPromise();
      console.log(`[Admin] Template ${template.id} deleted`);
      await this.loadTemplates(); // Refresh templates
    } catch (error) {
      console.error('[Admin] Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
  }

  getTabTitle(): string {
    switch (this.selectedTab()) {
      case 'overview': return 'Dashboard Overview';
      case 'users': return 'User Management';
      case 'quizzes': return 'Quiz Management';
      case 'reports': return 'Reports & Analytics';
      case 'settings': return 'System Settings';
      default: return 'Admin Dashboard';
    }
  }

  getTabSubtitle(): string {
    switch (this.selectedTab()) {
      case 'overview': return 'Monitor system activity and key metrics';
      case 'users': return 'Manage user accounts, roles, and permissions';
      case 'quizzes': return 'Oversee all quizzes, surveys, and polls';
      case 'reports': return 'View detailed analytics and performance reports';
      case 'settings': return 'Configure system preferences and settings';
      default: return 'Welcome to the admin control panel';
    }
  }

  getCurrentDateTime(): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());
  }

  getRoleIcon(role: string): string {
    return this.adminService.getRoleIcon(role);
  }

  getRoleClass(role: string): string {
    return this.adminService.getRoleClass(role);
  }

  formatDate(date: Date | string | undefined): string {
    return this.adminService.formatDate(date);
  }

  formatUserName(user: AdminUser): string {
    return this.adminService.formatUserName(user.firstName, user.lastName);
  }

  getUserRoles(user: AdminUser): string {
    return user.employeeRoles.map(r => r.roleName).join(', ') || 'No Role';
  }

  getUserMainRole(user: AdminUser): string {
    const roles = user.employeeRoles;
    if (roles.length === 0) return 'User';
    
    // Prioritize Admin > Host > Participant
    const priority = ['admin', 'host', 'participant', 'viewer'];
    const sortedRoles = roles.sort((a, b) => {
      const aIndex = priority.indexOf(a.roleName.toLowerCase());
      const bIndex = priority.indexOf(b.roleName.toLowerCase());
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    return sortedRoles[0].roleName;
  }

  async toggleUserStatus(userId: string) {
    try {
      const user = this.users().find(u => u.id === userId);
      if (!user) return;
      
      const action = user.isActive ? 'deactivate' : 'activate';
      const confirmMessage = `Are you sure you want to ${action} ${user.firstName} ${user.lastName}?`;
      
      if (!confirm(confirmMessage)) return;

      await this.adminService.updateUserStatus(user.employeeId, !user.isActive).toPromise();
      console.log(`[Admin] User ${userId} status toggled to ${!user.isActive}`);
      await this.loadUsers(); // Refresh users
      
      const statusMessage = user.isActive ? 'deactivated' : 'activated';
      alert(`User ${user.firstName} ${user.lastName} has been ${statusMessage} successfully!`);
    } catch (error) {
      console.error('[Admin] Error toggling user status:', error);
      alert('Failed to update user status. Please try again.');
    }
  }

  getStatusClass(isActive: boolean): string {
    return isActive ? 'status-active' : 'status-inactive';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  formatTimeAgo(timestamp: string | Date): string {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return time.toLocaleDateString();
  }

  refreshData() {
    this.loadAdminData();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/landing']);
  }
}