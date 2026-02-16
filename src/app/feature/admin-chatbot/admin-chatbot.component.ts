import { Component, OnInit, OnDestroy, inject, signal, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GenaiChatbotService } from '../../services/ai-chatbot.service';
import type { ChatMessage } from '../../services/ai-chatbot.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-chatbot.component.html',
  styleUrls: ['./admin-chatbot.component.css']
})
export class AdminChatbotComponent implements OnInit, OnDestroy {
  private chatbotService: GenaiChatbotService = inject(GenaiChatbotService);
  private destroyRef = inject(DestroyRef);

  messages = signal<ChatMessage[]>([]);
  inputMessage = signal('');
  isOpen = signal(false);
  isMinimized = signal(false);
  isLoading = signal(false);
  
  // Quick suggestions based on admin context
  quickSuggestions = [
    '📊 Show dashboard insights',
    '👥 Analyze user engagement',
    '📈 Quiz performance trends',
    '💬 Feedback analysis',
    '⚙️ System recommendations',
    '🔍 User activity summary'
  ];

  selectedSuggestion = signal<string | null>(null);

  ngOnInit() {
    // Subscribe to messages from service
    this.chatbotService.messages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msgs: ChatMessage[]) => {
        this.messages.set(msgs);
        // Auto-scroll to bottom after messages update
        setTimeout(() => this.scrollToBottom(), 100);
      });

    // Subscribe to loading state
    this.chatbotService.isTyping$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isTyping: boolean) => this.isLoading.set(isTyping));

    // Initial greeting
    this.addGreetingMessage();
  }

  private addGreetingMessage() {
    const greeting: ChatMessage = {
      id: `greeting_${Date.now()}`,
      role: 'assistant',
      content: `👋 Hello! I'm your AI Admin Assistant. I can help you with:
✨ Dashboard insights & analytics
📊 Quiz performance analysis
👥 User engagement metrics
💬 Feedback sentiment analysis
⚡ Quick recommendations

What would you like to know?`,
      timestamp: new Date()
    };
    this.chatbotService.addMessage(greeting);
  }

  toggleChat() {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen() && this.messages().length === 0) {
      this.addGreetingMessage();
    }
  }

  toggleMinimize() {
    this.isMinimized.set(!this.isMinimized());
  }

  async sendMessage() {
    const message = this.inputMessage().trim();
    if (!message || this.isLoading()) return;

    this.inputMessage.set('');
    try {
      await this.chatbotService.sendMessage(message);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: '❌ Sorry, an error occurred while processing your message. Please try again.',
        timestamp: new Date()
      };
      this.chatbotService.addMessage(errorMsg);
    }
  }

  async useSuggestion(suggestion: string) {
    this.selectedSuggestion.set(suggestion);
    
    // Map suggestion to actual query
    let actualMessage = suggestion;
    switch (suggestion) {
      case '📊 Show dashboard insights':
        actualMessage = 'What are the key insights from my current dashboard metrics? Please prioritize the most important areas for admin attention.';
        break;
      case '👥 Analyze user engagement':
        actualMessage = 'Based on the current user stats, what insights can you provide about user engagement and activity levels?';
        break;
      case '📈 Quiz performance trends':
        actualMessage = 'What trends are visible in quiz performance across all quizzes? Any patterns I should be aware of?';
        break;
      case '💬 Feedback analysis':
        actualMessage = 'Please analyze the recent feedback data. What are the main themes, sentiment distribution, and recommended actions?';
        break;
      case '⚙️ System recommendations':
        actualMessage = 'Based on my dashboard data, what system improvements or configurations would you recommend?';
        break;
      case '🔍 User activity summary':
        actualMessage = 'Can you provide a summary of recent user activity and identify any notable patterns or anomalies?';
        break;
    }

    this.inputMessage.set('');
    await this.chatbotService.sendMessage(actualMessage);
    
    setTimeout(() => this.selectedSuggestion.set(null), 2000);
  }

  clearChat() {
    if (confirm('Are you sure you want to clear the conversation? This cannot be undone.')) {
      this.chatbotService.clearMessages();
      this.addGreetingMessage();
    }
  }

  exportChat() {
    const messages = this.messages();
    const chatText = messages
      .map(msg => `[${msg.timestamp.toLocaleTimeString()}] ${msg.role === 'user' ? 'You' : 'AI'}:\n${msg.content}`)
      .join('\n\n');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(chatText));
    element.setAttribute('download', `chat_export_${new Date().toISOString().slice(0, 10)}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  private scrollToBottom() {
    try {
      const messageContainer = document.querySelector('.chat-messages-container');
      if (messageContainer) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
      }
    } catch (err) {}
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatContent(content: string): string {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  ngOnDestroy() {
    // Cleanup
  }
}
