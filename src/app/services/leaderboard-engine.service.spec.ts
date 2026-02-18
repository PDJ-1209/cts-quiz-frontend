import { TestBed } from '@angular/core/testing';
import { LeaderboardEngineService } from './leaderboard-engine.service';
import { AnswerEvent } from '../models/answer-event.model';
import { LeaderboardEntry } from '../models/leaderboard-entry.model';
import { Player } from '../models/player.model';

describe('LeaderboardEngineService', () => {
  let service: LeaderboardEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeaderboardEngineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Scoring', () => {
    it('should award base points for correct answer', () => {
      service.initializePlayer('player1');
      
      const event: AnswerEvent = {
        playerId: 'player1',
        questionId: 'q1',
        isCorrect: true,
        responseTimeMs: 15000, // Mid-range
        timestamp: Date.now()
      };

      const stats = service.processAnswer(event);
      
      expect(stats.totalScore).toBeGreaterThan(0);
      expect(stats.totalCorrect).toBe(1);
      expect(stats.totalAnswered).toBe(1);
    });

    it('should award speed bonus for fast answers', () => {
      service.initializePlayer('player1');
      
      const fastEvent: AnswerEvent = {
        playerId: 'player1',
        questionId: 'q1',
        isCorrect: true,
        responseTimeMs: 3000, // Fast
        timestamp: Date.now()
      };

      const slowEvent: AnswerEvent = {
        playerId: 'player1',
        questionId: 'q2',
        isCorrect: true,
        responseTimeMs: 25000, // Slow
        timestamp: Date.now()
      };

      // Reset for clean test
      service.reset();
      service.initializePlayer('player1');
      const fastStats = service.processAnswer(fastEvent);
      const fastScore = fastStats.totalScore;

      service.reset();
      service.initializePlayer('player1');
      const slowStats = service.processAnswer(slowEvent);
      const slowScore = slowStats.totalScore;

      expect(fastScore).toBeGreaterThan(slowScore);
    });

    it('should apply penalty for incorrect answers', () => {
      service.initializePlayer('player1');
      
      const correctEvent: AnswerEvent = {
        playerId: 'player1',
        questionId: 'q1',
        isCorrect: true,
        responseTimeMs: 10000,
        timestamp: Date.now()
      };

      const incorrectEvent: AnswerEvent = {
        playerId: 'player1',
        questionId: 'q2',
        isCorrect: false,
        responseTimeMs: 10000,
        timestamp: Date.now()
      };

      service.processAnswer(correctEvent);
      const scoreAfterCorrect = service.getPlayerStats('player1')!.totalScore;
      
      service.processAnswer(incorrectEvent);
      const scoreAfterIncorrect = service.getPlayerStats('player1')!.totalScore;

      expect(scoreAfterIncorrect).toBeLessThan(scoreAfterCorrect);
    });

    it('should track accuracy correctly', () => {
      service.initializePlayer('player1');
      
      // 2 correct, 1 incorrect = 66.67% accuracy
      service.processAnswer({
        playerId: 'player1',
        questionId: 'q1',
        isCorrect: true,
        responseTimeMs: 10000,
        timestamp: Date.now()
      });

      service.processAnswer({
        playerId: 'player1',
        questionId: 'q2',
        isCorrect: true,
        responseTimeMs: 10000,
        timestamp: Date.now()
      });

      service.processAnswer({
        playerId: 'player1',
        questionId: 'q3',
        isCorrect: false,
        responseTimeMs: 10000,
        timestamp: Date.now()
      });

      const stats = service.getPlayerStats('player1')!;
      expect(stats.accuracyPercent).toBe(67); // Rounded
      expect(stats.totalCorrect).toBe(2);
      expect(stats.totalAnswered).toBe(3);
    });

    it('should track streaks correctly', () => {
      service.initializePlayer('player1');
      
      // Build streak
      service.processAnswer({
        playerId: 'player1',
        questionId: 'q1',
        isCorrect: true,
        responseTimeMs: 10000,
        timestamp: Date.now()
      });

      service.processAnswer({
        playerId: 'player1',
        questionId: 'q2',
        isCorrect: true,
        responseTimeMs: 10000,
        timestamp: Date.now()
      });

      let stats = service.getPlayerStats('player1')!;
      expect(stats.streakCorrect).toBe(2);

      // Break streak
      service.processAnswer({
        playerId: 'player1',
        questionId: 'q3',
        isCorrect: false,
        responseTimeMs: 10000,
        timestamp: Date.now()
      });

      stats = service.getPlayerStats('player1')!;
      expect(stats.streakCorrect).toBe(0);
    });
  });

  describe('Tie-Breaking and Sorting', () => {
    it('should sort by score descending', () => {
      const entries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p2', 200),
        createMockEntry('p3', 150)
      ];

      const sorted = service.sortByRank(entries);

      expect(sorted[0].stats.totalScore).toBe(200);
      expect(sorted[1].stats.totalScore).toBe(150);
      expect(sorted[2].stats.totalScore).toBe(100);
    });

    it('should break ties by cumulative speed (lower is better)', () => {
      const entries: LeaderboardEntry[] = [
        createMockEntry('p1', 100, 30000), // Same score, slower
        createMockEntry('p2', 100, 20000)  // Same score, faster
      ];

      const sorted = service.sortByRank(entries);

      expect(sorted[0].player.playerId).toBe('p2'); // Faster player first
      expect(sorted[1].player.playerId).toBe('p1');
    });

    it('should have stable sort by playerId', () => {
      const entries: LeaderboardEntry[] = [
        createMockEntry('p-zebra', 100, 20000),
        createMockEntry('p-alpha', 100, 20000)
      ];

      const sorted = service.sortByRank(entries);

      expect(sorted[0].player.playerId).toBe('p-alpha'); // Alphabetically first
      expect(sorted[1].player.playerId).toBe('p-zebra');
    });
  });

  describe('Rank Changes', () => {
    it('should compute rank changes correctly', () => {
      const oldEntries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p2', 90),
        createMockEntry('p3', 80)
      ];

      const newEntries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p3', 95),  // Moved up
        createMockEntry('p2', 90)   // Moved down
      ];

      const changes = service.computeRankChanges(oldEntries, newEntries);

      const p3Change = changes.find(c => c.playerId === 'p3');
      const p2Change = changes.find(c => c.playerId === 'p2');

      expect(p3Change?.rankDelta).toBe(1); // Moved up 1 rank (3rd to 2nd)
      expect(p2Change?.rankDelta).toBe(-1); // Moved down 1 rank (2nd to 3rd)
    });

    it('should detect champion transitions', () => {
      const oldEntries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p2', 90)
      ];

      const newEntries: LeaderboardEntry[] = [
        createMockEntry('p2', 110),  // Became champion
        createMockEntry('p1', 100)
      ];

      const changes = service.computeRankChanges(oldEntries, newEntries);
      const championChange = changes.find(c => c.playerId === 'p2');

      expect(championChange?.becameChampion).toBe(true);
      expect(championChange?.newRank).toBe(1);
    });

    it('should detect top 3 entries', () => {
      const oldEntries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p2', 90),
        createMockEntry('p3', 80),
        createMockEntry('p4', 70)
      ];

      const newEntries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p2', 90),
        createMockEntry('p4', 85),  // Entered top 3
        createMockEntry('p3', 80)
      ];

      const changes = service.computeRankChanges(oldEntries, newEntries);
      const top3Entry = changes.find(c => c.playerId === 'p4');

      expect(top3Entry?.enteredTop3).toBe(true);
      expect(top3Entry?.newRank).toBe(3);
    });
  });

  describe('Delta Computation', () => {
    it('should track rank deltas', () => {
      service.initializePlayer('p1');
      service.initializePlayer('p2');

      const entries: LeaderboardEntry[] = [
        createMockEntry('p1', 100),
        createMockEntry('p2', 90)
      ];

      service.updateRanks(entries);

      // Manually set previous ranks for test
      entries[0].stats.previousRank = 2;
      entries[0].stats.currentRank = 1;
      
      expect(entries[0].stats.lastDeltaRank).toBe(1); // Moved up 1
    });
  });

  // Helper function to create mock entries
  function createMockEntry(
    playerId: string, 
    score: number, 
    cumulativeSpeed: number = 10000
  ): LeaderboardEntry {
    return {
      player: {
        playerId,
        nickname: playerId
      },
      stats: {
        playerId,
        totalScore: score,
        totalCorrect: 0,
        totalAnswered: 0,
        accuracyPercent: 0,
        cumulativeSpeedMs: cumulativeSpeed,
        averageSpeedMs: cumulativeSpeed,
        streakCorrect: 0,
        lastAnswerWasCorrect: false,
        lastDeltaRank: 0,
        lastScoreDelta: 0,
        currentRank: 0,
        previousRank: 0
      },
      isHighlighted: false,
      showDeltaLabel: false
    };
  }
});
