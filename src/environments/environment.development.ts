export const environment = {
  production: false,
  apiUrl: 'http://localhost:5195/api',
  signalRUrl: 'http://localhost:5195/quizSessionHub',
  enableLogging: true,
  demoMode: true, // For interview demo
  retryAttempts: 3,
  requestTimeout: 10000,  
  apiEndpoints: {
    template: '/Admin/Template', // Admin area: api/Admin/Template
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
    encryption: false
  }
};
