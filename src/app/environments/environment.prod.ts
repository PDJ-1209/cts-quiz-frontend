export const environment = {
  production: true,
  apiUrl: 'http://localhost:5195/api',
  apiBaseUrl: 'http://localhost:5195/api', // Added for theme API service
  signalRUrl: 'http://localhost:5195/hubs/quizHub',
  themeHubUrl: 'http://localhost:5195/hubs/themeHub', // Added for theme SignalR
  geminiApiKey: 'AIzaSyDxN-DOvaRt5JJvP0bKH-no_EAWxYA9rtY', // Gemini AI API key (should be env var in prod)
  enableLogging: false,
  demoMode: false,
  retryAttempts: 3,
  requestTimeout: 10000,
  apiEndpoints: {
    template: '/template', // Admin area: api/template (doesn't follow area pattern)
    questions: '/host/question', // Host area: api/host/question
    dashboard: '/admin', // Admin area: api/admin
    users: '/userManagement', // Admin area: api/userManagement (doesn't follow area pattern)
    metrics: '/admin/metrics', // Admin area: api/admin/metrics
    quiz: '/host/quiz', // Host area: api/host/quiz
    publish: '/host/publish', // Host area: api/host/publish
    session: '/participate/session', // Participate area: api/participate/session
    participate: '/participate/quiz', // Participate area: api/participate/quiz
    ai: '/ai' // AI endpoints: api/ai
  },
  features: {
    realTimeUpdates: true,
    analytics: true,
    collaboration: true
  },
  storage: {
    prefix: 'cts-quiz-',
    encryption: true
  }
};
