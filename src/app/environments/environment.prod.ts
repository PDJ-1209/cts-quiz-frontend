export const environment = {
  production: true,
  apiUrl: 'http://localhost:5195/api',
  signalRUrl: 'http://localhost:5195/hubs/quizHub',
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
    participate: '/participate/quiz' // Participate area: api/participate/quiz
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
