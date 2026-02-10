import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface AssignRoleRequest {
  employeeId: string;
  roleId: number;
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private base = `${environment.apiBase}/admin`;

  constructor(private http: HttpClient) {}

  assignRole(payload: AssignRoleRequest) {
    // Admin-only endpoint; JWT must include Admin role
    return this.http.post(`${this.base}/assign-role`, payload, { responseType: 'text' });
  }
}