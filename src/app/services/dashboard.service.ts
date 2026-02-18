import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { metricsInterface } from '../models/metricsInterface';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  
  constructor(private http: HttpClient) { }
  private dashboardApiUrl = `${environment.apiUrl}${environment.apiEndpoints.dashboard}`;
  

  // Get dashboard metrics
  getDashboardData(): Observable<any> {
    return this.http.get<any>(this.dashboardApiUrl);
  }

  // Get recent activity
  getRecentActivity(): Observable<any[]> {
    return this.http.get<any[]>(`${this.dashboardApiUrl}/recent-activity`);
  }


}
