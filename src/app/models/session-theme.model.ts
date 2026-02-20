// Session-based theme management interfaces
export interface ApplySessionThemeRequest {
  sessionId: number;
  themeId: number;
}

// Keep the old room-based interface for backward compatibility
export interface ApplyThemeRequest {
  roomId: string;
  themeId: number;
}