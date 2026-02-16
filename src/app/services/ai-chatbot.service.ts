import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { inject } from '@angular/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface ChatContext {
  totalUsers?: number;
  activeHosts?: number;
  totalQuizzes?: number;
  activeSessions?: number;
  recentFeedback?: string[];
  topQuizzes?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class GenaiChatbotService {
  messages$ = new BehaviorSubject<ChatMessage[]>([]);
  isTyping$ = new BehaviorSubject<boolean>(false);
  private context$ = new BehaviorSubject<ChatContext>({});

  constructor() {}

  setContext(context: ChatContext): void {
    console.log('📊 Chatbot context updated:', context);
    this.context$.next(context);
  }

  private getContext(): ChatContext {
    return this.context$.getValue();
  }

  addMessage(message: ChatMessage): void {
    const current = this.messages$.getValue();
    this.messages$.next([...current, message]);
  }

  clearMessages(): void {
    this.messages$.next([]);
  }

  private generateMockResponse(userMessage: string): string {
    const context = this.getContext();
    const msg = userMessage.toLowerCase();
    
    if (msg.includes('dashboard') || msg.includes('insight')) {
      return `📊 **Dashboard Insights**\n\nCurrent metrics:\n• Total Users: ${context.totalUsers || 0}\n• Active Hosts: ${context.activeHosts || 0}\n• Total Quizzes: ${context.totalQuizzes || 0}\n• Active Sessions: ${context.activeSessions || 0}\n\nYour dashboard is performing well with consistent engagement.`;
    }
    
    if (msg.includes('engagement') || msg.includes('user') || msg.includes('host') || msg.includes('active')) {
      return `👥 **User Engagement**\n\nActive Hosts: ${context.activeHosts || 0}\nTotal Users: ${context.totalUsers || 0}\n\nEngagement is trending positively. Users are spending more time in quizzes and providing quality feedback.`;
    }
    
    if (msg.includes('quiz') || msg.includes('performance')) {
      const topQuizzes = context.topQuizzes?.slice(0, 3).map((q: any) => q.title || q).join(', ') || 'Featured quizzes';
      return `🎯 **Quiz Performance**\n\nTop Quizzes: ${topQuizzes}\n\nAverage Completion: 85%\nAverage Score: 78%\n\nQuizzes are performing above baseline expectations.`;
    }
    
    if (msg.includes('feedback') || msg.includes('comment')) {
      return `💬 **Feedback Analysis**\n\nRecent themes: ${context.recentFeedback?.slice(0, 2).join(', ') || 'Positive responses'}\n\nSentiment Distribution:\n• Positive: 72%\n• Neutral: 18%\n• Negative: 10%`;
    }
    
    if (msg.includes('recommend') || msg.includes('suggest')) {
      return `💡 **Recommendations**\n\n1. Continue promoting top quizzes\n2. Engage inactive users\n3. Improve feedback collection\n4. Expand quiz offerings\n5. Optimize user experience`;
    }
    
    return `🤖 **How I Can Help**\n\nI'm your AI Admin Assistant. Ask me about:\n• Dashboard insights\n• User engagement metrics\n• Quiz performance\n• Feedback analysis\n• System recommendations`;
  }

  async sendMessage(userMessage: string): Promise<void> {
    if (!userMessage.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    this.addMessage(userMsg);
    this.isTyping$.next(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const response = this.generateMockResponse(userMessage);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      this.addMessage(assistantMsg);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '❌ Error processing request',
        timestamp: new Date()
      };
      this.addMessage(errorMsg);
    } finally {
      this.isTyping$.next(false);
    }
  }
}
