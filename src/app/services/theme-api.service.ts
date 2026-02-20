// // // import { Injectable } from '@angular/core';

// // // @Injectable({
// // //   providedIn: 'root'
// // // })
// // // export class ThemeApiService {

// // //   constructor() { }
// // // }


// // import { Injectable } from '@angular/core';
// // import { HttpClient } from '@angular/common/http';
// // import { environment } from '../../environments/environment';
// // import { ThemeCreateModel, ThemeModel } from '../models/theme.model';
// // import { ApplyThemeRequest } from '../models/room.model';

// // @Injectable({ providedIn: 'root' })
// // export class ThemeApiService {
// //   private base = environment.apiBaseUrl;

// //   constructor(private http: HttpClient) {}

// //   // Default + custom themes
// //   getThemes() {
// //     return this.http.get<ThemeModel[]>(`${this.base}/host/api/themes`);
// //   }

// //   // Create custom theme
// //   createTheme(payload: ThemeCreateModel) {
// //     return this.http.post<ThemeModel>(`${this.base}/host/api/themes`, payload);
// //   }

// //   // Current theme applied to a room (for late joiners)
// //   getCurrentTheme(roomId: string) {
// //     return this.http.get<ThemeModel>(`${this.base}/host/api/roomthemes/current?roomId=${roomId}`);
// //   }

// //   // Apply theme to room (save in DB)
// //   applyTheme(payload: ApplyThemeRequest) {
// //     return this.http.post<void>(`${this.base}/host/api/roomthemes/apply`, payload);
// //   }
// // }
// import { Injectable } from '@angular/core';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { environment } from '../../environments/environment';
// import { ThemeCreateModel, ThemeModel } from '../models/theme.model';
// import { ApplyThemeRequest } from '../models/room.model';

// @Injectable({ providedIn: 'root' })
// export class ThemeApiService {
//   private base = environment.apiBaseUrl.replace(/\/$/, '');

//   constructor(private http: HttpClient) {}

//   // ✅ Default + custom themes (optionally filtered by hostId)
//   getThemes(hostId?: string) {
//     let params = new HttpParams();
//     if (hostId) params = params.set('hostId', hostId);

//     return this.http.get<ThemeModel[]>(`${this.base}/host/api/themes`, { params });
//   }

//   // ✅ Create custom theme (optionally send hostId)
//   createTheme(payload: ThemeCreateModel, hostId?: string) {
//     console.log('🎨 POST /host/api/themes/custom', payload);
    
//     // ✅ Validate backgroundColor is not empty before sending
//     if (!payload.backgroundColor || payload.backgroundColor === '') {
//       console.warn('⚠️ WARNING: backgroundColor is empty in createTheme payload!');
//       console.warn('This may cause the field to not be saved in the database.');
//     }
    
//     let params = new HttpParams();
//     if (hostId) params = params.set('hostId', hostId);

//     return this.http.post<ThemeModel>(`${this.base}/host/api/themes/custom`, payload, { params });
//   }

//   // ✅ Current theme applied to a room (for late joiners)
//   getCurrentTheme(roomId: string) {
//     const params = new HttpParams().set('roomId', roomId);

//     return this.http.get<ThemeModel>(`${this.base}/host/api/rooms/current-theme`, { params });
//   }

//   // ✅ Apply theme to room (save in DB)
//   applyTheme(payload: ApplyThemeRequest) {
//     return this.http.post<void>(`${this.base}/host/api/rooms/apply-theme`, payload);
//   }

//   // ✅ Delete custom theme
//   // 
//   // DELETE /host/api/themes/{id}
//   // Removes the theme from the database
//   // Frontend will remove it from local state after successful deletion
//   deleteTheme(themeId: number) {
//     const url = `${this.base}/host/api/themes/${themeId}`;
//     console.log('🗑️ DELETE Request:');
//     console.log('  URL:', url);
//     console.log('  Theme ID:', themeId);
//     console.log('  Method: DELETE');
//     console.log('  Expected Response: 200 OK or 204 No Content');
    
//     return this.http.delete<void>(url);
//   }

//   // ✅ Update custom theme
//   // 
//   // ⚠️ IMPORTANT: This is for EDITING existing themes, not applying them to rooms
//   // Common confusion: 
//   // - PUT /host/api/themes/{id} = UPDATE theme definition (name, colors, etc.)
//   // - POST /host/api/rooms/apply-theme = APPLY theme to a room
//   // 
//   // If you see "edit button not working":
//   // 1. Check browser console for: "✏️ Edit button clicked"
//   // 2. Check if customize form loads with pre-filled data
//   // 3. Make changes and click Save
//   // 4. Look for: "🔧 PUT /host/api/themes/{id}" in console
//   // 5. Check if PUT succeeds (200) or fails (400/500)
//   // 
//   // If you see 400 errors for /rooms/apply-theme:
//   // - That's a DIFFERENT operation (applying theme to room)
//   // - Not related to theme editing
//   // - Means the room doesn't exist in backend
//   // 
//   // Backend checklist for backgroundColor field:
//   // 1. Theme entity has [BackgroundColor] property (nullable string)
//   // 2. PUT endpoint accepts ThemeCreateModel/ThemeDto with backgroundColor
//   // 3. Controller maps backgroundColor from request body to entity
//   // 4. DbContext saves backgroundColor field (check EF migrations)
//   updateTheme(themeId: number, hostId: string, payload: ThemeCreateModel) {
//     const url = `${this.base}/host/api/themes/${themeId}?hostId=${hostId}`;
    
//     console.log('🔧 PUT Request:');
//     console.log('  URL:', url);
//     console.log('  Theme ID:', themeId);
//     console.log('  Host ID:', hostId);
//     console.log('  Method: PUT');
//     console.log('  Payload:', JSON.stringify(payload, null, 2));
//     console.log('  Expected Response: 200 OK with updated theme object');
    
//     // ✅ Validate backgroundColor is not empty before sending
//     if (!payload.backgroundColor || payload.backgroundColor === '') {
//       console.error('❌ CRITICAL: backgroundColor is empty in updateTheme payload!');
//       console.error('This will cause the field to not be saved in the database.');
//     } else {
//       console.log('  ✅ backgroundColor:', payload.backgroundColor);
//     }
    
//     return this.http.put<ThemeModel>(url, payload);
//   }

// }

  
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ThemeCreateModel, ThemeModel } from '../models/theme.model';
import { ApplyThemeRequest } from '../models/room.model';
import { ApplySessionThemeRequest } from '../models/session-theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeApiService {
  private base = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  // ✅ GET host/api/themes?hostId=H001  (hostId REQUIRED by backend)
  getThemes(hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.get<ThemeModel[]>(`${this.base}/host/api/themes`, { params });
  }

  // ✅ POST host/api/themes/custom?hostId=H001  (hostId REQUIRED by backend)
  createCustomTheme(hostId: string, payload: ThemeCreateModel) {
    console.log('📤 API: POST /host/api/themes/custom');
    console.log('📤 API: hostId:', hostId);
    console.log('📤 API: Request Body:', JSON.stringify(payload, null, 2));
    console.log('📤 API: backgroundColor in payload:', payload.backgroundColor);
    
    const params = new HttpParams().set('hostId', hostId);
    return this.http.post<ThemeModel>(`${this.base}/host/api/themes/custom`, payload, { params });
  }

  // ✅ GET host/api/themes/{id}
  getThemeById(id: number) {
    return this.http.get<ThemeModel>(`${this.base}/host/api/themes/${id}`);
  }

  // ✅ PUT host/api/themes/{id}?hostId=H001  (hostId REQUIRED by backend)
  updateTheme(themeId: number, hostId: string, payload: ThemeCreateModel) {
    console.log('📤 API: PUT /host/api/themes/' + themeId);
    console.log('📤 API: hostId:', hostId);
    console.log('📤 API: Request Body:', JSON.stringify(payload, null, 2));
    console.log('📤 API: backgroundColor in payload:', payload.backgroundColor);
    
    const params = new HttpParams().set('hostId', hostId);
    return this.http.put<ThemeModel>(`${this.base}/host/api/themes/${themeId}`, payload, { params });
  }

  // ✅ DELETE host/api/themes/{id}?hostId=H001  (send hostId to avoid "not allowed")
  deleteTheme(themeId: number, hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    return this.http.delete<void>(`${this.base}/host/api/themes/${themeId}`, { params });
  }

  // -------------------------------------------------------
  // NOTE: These two endpoints are NOT in the backend you pasted.
  // Keep them only if you have a separate Rooms/RoomThemes controller.
  // -------------------------------------------------------

  // ✅ Current theme applied to a room (late joiners)
  getCurrentTheme(roomId: string) {
    const params = new HttpParams().set('roomId', roomId);
    return this.http.get<ThemeModel>(`${this.base}/host/api/rooms/current-theme`, { params });
  }

  // ✅ Apply theme to room
  applyTheme(payload: ApplyThemeRequest) {
    return this.http.post<void>(`${this.base}/host/api/rooms/apply-theme`, payload);
  }

  // ✅ Upload image file and get Base64 data URL
  uploadThemeImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    console.log('📤 API: POST /host/api/themes/upload-image');
    console.log('📤 API: File name:', file.name);
    console.log('📤 API: File size:', file.size, 'bytes');
    console.log('📤 API: File type:', file.type);

    return this.http.post<{ imageUrl: string }>(
      `${this.base}/host/api/themes/upload-image`,
      formData
    );
  }

  // ===== SESSION-BASED THEME MANAGEMENT =====

  // ✅ Get current theme applied to a session
  getCurrentSessionTheme(sessionId: number) {
    return this.http.get<ThemeModel>(`${this.base}/host/api/session-themes/current/${sessionId}`);
  }

  // ✅ Apply theme to session
  applyThemeToSession(payload: ApplySessionThemeRequest, hostId: string) {
    const params = new HttpParams().set('hostId', hostId);
    console.log('📤 API: POST /host/api/session-themes/apply');
    console.log('📤 API: Payload:', JSON.stringify(payload));
    console.log('📤 API: Host ID:', hostId);
    
    return this.http.post<void>(`${this.base}/host/api/session-themes/apply`, payload, { params });
  }

  // ✅ Remove theme from session
  removeThemeFromSession(sessionId: number) {
    return this.http.delete<void>(`${this.base}/host/api/session-themes/${sessionId}`);
  }
}

//------------------------------------------------------------