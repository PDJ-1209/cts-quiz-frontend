import { Injectable } from '@angular/core';
import { Observable, interval, map, take, concatMap, delay, of } from 'rxjs';
import { AnswerEvent } from '../models/answer-event.model';
import { Player } from '../models/player.model';

/**
 * RealtimeFeedService
 * 
 * Mock event generator that simulates real-time answer events from players.
 * In production, replace this with WebSocket or SSE connection to backend.
 * 
 * Emits AnswerEvents at configurable rate with realistic randomization:
 * - Random players answering
 * - Varying correctness (weighted)
 * - Realistic response times
 */
@Injectable({
  providedIn: 'root'
})
export class RealtimeFeedService {
  private eventIntervalMs = 1000; // Base interval between events
  private questionCounter = 0;

  constructor() {}

  /**
   * Set the interval between events (in milliseconds)
   */
  setEventInterval(ms: number): void {
    this.eventIntervalMs = ms;
  }

  /**
   * Generate a stream of mock answer events
   * 
   * @param players - Array of players to simulate
   * @param eventsPerSecond - Target rate of events (3-6 recommended)
   * @param totalEvents - Total number of events to generate (optional, infinite if not provided)
   */
  generateEventStream(
    players: Player[],
    eventsPerSecond: number = 4,
    totalEvents?: number
  ): Observable<AnswerEvent> {
    const intervalMs = 1000 / eventsPerSecond;

    let stream$ = interval(intervalMs).pipe(
      map(() => this.generateRandomEvent(players))
    );

    if (totalEvents) {
      stream$ = stream$.pipe(take(totalEvents));
    }

    return stream$;
  }

  /**
   * Generate a burst of events (all players answer same question)
   * Useful for simulating synchronized question completion
   */
  generateQuestionBurst(players: Player[]): Observable<AnswerEvent> {
    const questionId = `q-${++this.questionCounter}`;
    
    // Shuffle players and add slight delays for realism
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    return of(...shuffled).pipe(
      concatMap((player, index) => 
        of(this.generateEvent(player, questionId)).pipe(
          delay(index * 200) // 200ms stagger
        )
      )
    );
  }

  /**
   * Generate a single random event
   */
  private generateRandomEvent(players: Player[]): AnswerEvent {
    const player = this.pickRandomPlayer(players);
    const questionId = `q-${this.questionCounter}`;
    
    // Occasionally increment question (simulate new questions)
    if (Math.random() > 0.7) {
      this.questionCounter++;
    }

    return this.generateEvent(player, questionId);
  }

  /**
   * Generate an event for a specific player
   */
  private generateEvent(player: Player, questionId: string): AnswerEvent {
    // Weighted correctness: 65% correct, 35% incorrect (realistic for quiz)
    const isCorrect = Math.random() < 0.65;

    // Response time distribution:
    // - Fast (3-7s): 30%
    // - Medium (7-15s): 50%
    // - Slow (15-25s): 20%
    let responseTimeMs: number;
    const speedDice = Math.random();
    
    if (speedDice < 0.3) {
      // Fast
      responseTimeMs = 3000 + Math.random() * 4000;
    } else if (speedDice < 0.8) {
      // Medium
      responseTimeMs = 7000 + Math.random() * 8000;
    } else {
      // Slow
      responseTimeMs = 15000 + Math.random() * 10000;
    }

    // Incorrect answers tend to be slower (people guessing)
    if (!isCorrect) {
      responseTimeMs *= 1.3;
    }

    responseTimeMs = Math.min(30000, Math.round(responseTimeMs));

    return {
      playerId: player.playerId,
      questionId,
      isCorrect,
      responseTimeMs,
      timestamp: Date.now(),
    };
  }

  /**
   * Pick a random player with slight weighting toward active players
   */
  private pickRandomPlayer(players: Player[]): Player {
    const index = Math.floor(Math.random() * players.length);
    return players[index];
  }

  /**
   * Reset question counter
   */
  reset(): void {
    this.questionCounter = 0;
  }
}
