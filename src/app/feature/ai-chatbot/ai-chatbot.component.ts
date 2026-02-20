import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiAiService, ChatMessage, QuizGenerationRequest } from '../../services/gemini-ai.service';
import { SpeechRecognitionService } from '../../services/speech-recognition.service';
import { AuthService } from '../../services/auth.service';
import { QuizCreationService } from '../../services/quiz-creation.service';
import { QuizMeta, QuizQuestion } from '../../models/quiz.models';
import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-ai-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chatbot.component.html',
  styleUrls: ['./ai-chatbot.component.css'],
  animations: [
    trigger('slideIn', [
      state('in', style({transform: 'translateY(0)', opacity: 1})),
      transition('void => *', [
        style({transform: 'translateY(100%)', opacity: 0}),
        animate('300ms ease-in')
      ]),
      transition('* => void', [
        animate('300ms ease-out', style({transform: 'translateY(100%)', opacity: 0}))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class AiChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  private geminiService = inject(GeminiAiService);
  private speechService = inject(SpeechRecognitionService);
  private authService = inject(AuthService);
  private quizService = inject(QuizCreationService);

  isOpen = false;
  currentMessage = '';
  messages: ChatMessage[] = [];
  isLoading = false;

  // Speech recognition properties
  isListening = false;
  isSpeechSupported = false;
  recognizedText = '';

  // Dark mode
  isDarkMode = false;

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.addWelcomeMessage();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.speechService.stopListening();
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private initializeSubscriptions(): void {
    // Chat messages subscription
    this.subscriptions.push(
      this.geminiService.chatMessages$.subscribe(messages => {
        this.messages = messages;
      })
    );

    // Speech recognition subscriptions
    this.subscriptions.push(
      this.speechService.isSupported$.subscribe(supported => {
        this.isSpeechSupported = supported;
      })
    );

    this.subscriptions.push(
      this.speechService.isListening$.subscribe(listening => {
        this.isListening = listening;
      })
    );

    this.subscriptions.push(
      this.speechService.recognizedText$.subscribe(text => {
        if (text && text.trim()) {
          this.recognizedText = text;
          this.currentMessage = text;
          this.speechService.clearRecognizedText();
        }
      })
    );

    // Dark mode subscription
    this.subscriptions.push(
      this.geminiService.isDarkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
      })
    );
  }

  private addWelcomeMessage(): void {
    const user = this.authService.currentUser();
    const hostName = user ? `${user.firstName} ${user.lastName}` : 'Host';
    this.geminiService.addWelcomeMessage(hostName);
  }

  toggleChatbot(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messageInput) {
      setTimeout(() => {
        this.messageInput.nativeElement.focus();
      }, 100);
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.currentMessage.trim() || this.isLoading) return;

    this.isLoading = true;
    const message = this.currentMessage.trim();
    this.currentMessage = '';

    try {
      // Check for specific commands
      await this.processCommand(message);
      
      // Send to Gemini AI
      await this.geminiService.sendMessage(message);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private async processCommand(message: string): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Test API connection
    if (lowerMessage.includes('test api') || lowerMessage.includes('test connection')) {
      this.addSystemMessage('🔄 Testing API connection...');
      try {
        const testResponse = await this.geminiService.sendMessage('Say hello');
        this.addSystemMessage('✅ API connection successful!');
      } catch (error) {
        this.addSystemMessage('❌ API connection failed. Check console for details.');
        console.error('API Test Error:', error);
      }
      return;
    }

    // Theme commands
    if (lowerMessage.includes('dark mode') || lowerMessage.includes('dark theme')) {
      if (!this.isDarkMode) {
        this.geminiService.toggleDarkMode();
        this.addSystemMessage('✅ Switched to dark mode!');
      } else {
        this.addSystemMessage('🌙 Already in dark mode!');
      }
      return;
    }

    if (lowerMessage.includes('light mode') || lowerMessage.includes('light theme')) {
      if (this.isDarkMode) {
        this.geminiService.toggleDarkMode();
        this.addSystemMessage('✅ Switched to light mode!');
      } else {
        this.addSystemMessage('☀️ Already in light mode!');
      }
      return;
    }

    // Quiz creation commands
    if (lowerMessage.includes('create quiz') || lowerMessage.includes('generate quiz')) {
      await this.handleQuizCreation(message);
      return;
    }

    // Clear chat command
    if (lowerMessage.includes('clear chat') || lowerMessage.includes('clear history')) {
      this.geminiService.clearChat();
      this.addWelcomeMessage();
      return;
    }
  }

  private async handleQuizCreation(message: string): Promise<void> {
    try {
      // Extract topic from message
      const topicMatch = message.match(/about\s+([^,\n]+)/i) || message.match(/on\s+([^,\n]+)/i);
      const topic = topicMatch ? topicMatch[1].trim() : 'General Knowledge';

      // Extract number of questions (default 10)
      const questionMatch = message.match(/(\d+)\s+questions?/i);
      const numberOfQuestions = questionMatch ? parseInt(questionMatch[1]) : 10;

      // Extract difficulty (default medium)
      let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
      if (message.toLowerCase().includes('easy')) difficulty = 'easy';
      if (message.toLowerCase().includes('hard') || message.toLowerCase().includes('difficult')) difficulty = 'hard';

      // Extract timer (default 30 seconds)
      const timerMatch = message.match(/(\d+)\s+seconds?/i) || message.match(/timer\s+(\d+)/i);
      const timer = timerMatch ? parseInt(timerMatch[1]) : 30;

      this.addSystemMessage(`🎯 Creating a ${difficulty} quiz about "${topic}" with ${numberOfQuestions} questions (${timer}s per question)...`);

      const quizRequest: QuizGenerationRequest = {
        topic,
        numberOfQuestions,
        difficulty,
        timer,
        category: 'AI Generated'
      };

      const generatedQuiz = await this.geminiService.generateQuiz(quizRequest);
      
      // Save quiz to the system
      await this.saveGeneratedQuiz(generatedQuiz);
      
      this.addSystemMessage(`✅ Quiz "${generatedQuiz.title}" created successfully! You can find it in your quiz dashboard.`);

    } catch (error) {
      console.error('Error creating quiz:', error);
      this.addSystemMessage('❌ Sorry, I couldn\'t create the quiz. Please try again or check your input.');
    }
  }

  private async saveGeneratedQuiz(quiz: any): Promise<void> {
    try {
      // Convert to the format expected by your quiz creation service
      const quizMeta: QuizMeta = {
        quizNumber: 'TEMP-' + Date.now(), // Temporary number, server will overwrite
        quizName: quiz.title,
        category: quiz.category
      };

      const questions: QuizQuestion[] = quiz.questions.map((q: any) => ({
        questionText: q.questionText,
        options: q.options,
        correctAnswerIndex: q.options.findIndex((option: string) => option === q.correctAnswer),
        explanation: q.explanation || 'No explanation provided'
      }));

      // Use your existing quiz creation service
      await this.quizService.createQuiz(quizMeta, questions);
    } catch (error) {
      console.error('Error saving quiz:', error);
      throw error;
    }
  }

  private addSystemMessage(content: string): void {
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      sender: 'assistant',
      timestamp: new Date()
    };
    
    const currentMessages = this.messages;
    this.messages = [...currentMessages, systemMessage];
  }

  toggleSpeechRecognition(): void {
    if (!this.isSpeechSupported) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    this.speechService.toggleListening();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    if (this.chatContainer) {
      try {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      } catch (err) {
        console.warn('Could not scroll to bottom:', err);
      }
    }
  }

  clearChat(): void {
    this.geminiService.clearChat();
    this.addWelcomeMessage();
  }

  formatMessageContent(content: string): string {
    // Add basic formatting for better readability
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
}