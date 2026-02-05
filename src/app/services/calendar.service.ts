import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CalendarResponse } from '../models/calendar.models';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private baseUrl = `${environment.apiUrl}/Host/Publish`;

  constructor(private http: HttpClient) {}

  getCalendarData(hostId?: string): Observable<CalendarResponse> {
    const url = hostId 
      ? `${this.baseUrl}/calendar?hostId=${hostId}` 
      : `${this.baseUrl}/calendar`;
    return this.http.get<CalendarResponse>(url);
  }
}
