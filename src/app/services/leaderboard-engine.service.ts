import { Injectable } from '@angular/core';
import { PlayerStats } from '../models/player.model';
import { AnswerEvent } from '../models/answer-event.model';
import { LeaderboardEntry, RankChangeEvent } from '../models/leaderboard-entry.model';
import { GameConfig, DEFAULT_GAME_CONFIG } from '../models/host-settings.model';

/**
 * LeaderboardEngineService
 * 
 * Core scoring engine responsible for:
 * - Computing scores from answer events
 * - Sorting with tie-breaking rules
 * - Computing rank changes and deltas
 * - Tracking streaks and statistics
 * 
 * SCORING FORMULA:
 * Correct answer:
 *   score = basePointsCorrect + speedBonus
 *   speedBonus = speedBonusMax * (1 - responseTimeMs / maxAnswerTimeMs)
 *   speedBonus is clamped to [0, speedBonusMax]
 * 
 * Incorrect answer:
 *   score -= wrongAnswerPenalty
 *   streak resets to 0
 * 
 * TIE-BREAKING RULES (in order):
 * 1. totalScore (descending)
 * 2. cumulativeSpeedMs (ascending) - lower total time is better
 * 3. playerId (stable sort)
 */
@Injectable({
  providedIn: 'root'
})
export class LeaderboardEngineService {
  private config: GameConfig = DEFAULT_GAME_CONFIG;
  private playerStatsMap = new Map<string, PlayerStats>();

  constructor() {}

  /**
   * Set custom game configuration
   */
  setConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Initialize a new player
   */
  initializePlayer(playerId: string): PlayerStats {
    const stats: PlayerStats = {
      playerId,
      totalScore: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      accuracyPercent: 0,
      cumulativeSpeedMs: 0,
      averageSpeedMs: 0,
      streakCorrect: 0,
      lastAnswerWasCorrect: false,
      lastDeltaRank: 0,
      lastScoreDelta: 0,
      currentRank: 0,
      previousRank: 0,
    };
    this.playerStatsMap.set(playerId, stats);
    return stats;
  }

  /**
   * Process an answer event and update player stats
   */
  processAnswer(event: AnswerEvent): PlayerStats {
    let stats = this.playerStatsMap.get(event.playerId);
    
    if (!stats) {
      stats = this.initializePlayer(event.playerId);
    }

    // Clone stats for immutability
    stats = { ...stats };

    const previousScore = stats.totalScore;
    stats.totalAnswered++;
    stats.cumulativeSpeedMs += event.responseTimeMs;

    if (event.isCorrect) {
      // Calculate score with speed bonus
      const speedRatio = Math.max(0, Math.min(1, event.responseTimeMs / this.config.maxAnswerTimeMs));
      const speedBonus = Math.round(this.config.speedBonusMax * (1 - speedRatio));
      const earnedPoints = this.config.basePointsCorrect + speedBonus;

      stats.totalScore += earnedPoints;
      stats.totalCorrect++;
      stats.streakCorrect++;
      stats.lastAnswerWasCorrect = true;
      stats.lastScoreDelta = earnedPoints;
    } else {
      // Wrong answer
      const penalty = this.config.wrongAnswerPenalty;
      stats.totalScore = Math.max(0, stats.totalScore - penalty);
      stats.streakCorrect = 0;
      stats.lastAnswerWasCorrect = false;
      stats.lastScoreDelta = -penalty;
    }

    // Update derived stats
    stats.accuracyPercent = stats.totalAnswered > 0 
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) 
      : 0;
    stats.averageSpeedMs = stats.totalAnswered > 0
      ? Math.round(stats.cumulativeSpeedMs / stats.totalAnswered)
      : 0;

    this.playerStatsMap.set(event.playerId, stats);
    return stats;
  }

  /**
   * Get all player stats as array
   */
  getAllStats(): PlayerStats[] {
    return Array.from(this.playerStatsMap.values());
  }

  /**
   * Get stats for a specific player
   */
  getPlayerStats(playerId: string): PlayerStats | undefined {
    return this.playerStatsMap.get(playerId);
  }

  /**
   * Sort players by rank with tie-breaking rules
   * Returns a new sorted array (immutable)
   */
  sortByRank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return [...entries].sort((a, b) => {
      // Primary: totalScore descending
      if (a.stats.totalScore !== b.stats.totalScore) {
        return b.stats.totalScore - a.stats.totalScore;
      }

      // Secondary: cumulativeSpeedMs ascending (faster overall = better)
      if (a.stats.cumulativeSpeedMs !== b.stats.cumulativeSpeedMs) {
        return a.stats.cumulativeSpeedMs - b.stats.cumulativeSpeedMs;
      }

      // Tertiary: stable sort by playerId
      return a.player.playerId.localeCompare(b.player.playerId);
    });
  }

  /**
   * Compute rank changes between old and new leaderboard states
   * Returns array of rank change events for animations
   */
  computeRankChanges(
    oldEntries: LeaderboardEntry[],
    newEntries: LeaderboardEntry[]
  ): RankChangeEvent[] {
    const changes: RankChangeEvent[] = [];
    const oldRankMap = new Map<string, number>();

    // Build old rank map
    oldEntries.forEach((entry, index) => {
      oldRankMap.set(entry.player.playerId, index + 1);
    });

    // Compute changes
    newEntries.forEach((entry, index) => {
      const newRank = index + 1;
      const oldRank = oldRankMap.get(entry.player.playerId) || newRank;
      const rankDelta = oldRank - newRank; // Positive = moved up

      if (oldRank !== newRank) {
        const becameChampion = newRank === 1 && oldRank !== 1;
        const enteredTop3 = newRank <= 3 && oldRank > 3;

        changes.push({
          playerId: entry.player.playerId,
          nickname: entry.player.nickname,
          oldRank,
          newRank,
          rankDelta,
          scoreDelta: entry.stats.lastScoreDelta,
          becameChampion,
          enteredTop3,
        });
      }
    });

    return changes;
  }

  /**
   * Update rank fields in stats after sorting
   * Mutates entries for performance
   */
  updateRanks(entries: LeaderboardEntry[]): void {
    entries.forEach((entry, index) => {
      const rank = index + 1;
      entry.stats.previousRank = entry.stats.currentRank || rank;
      entry.stats.currentRank = rank;
      entry.stats.lastDeltaRank = entry.stats.previousRank - rank;
    });
  }

  /**
   * Check if player qualifies for speed badge
   */
  getSpeedBadge(stats: PlayerStats): 'fast' | 'slow' | null {
    if (stats.totalAnswered === 0) return null;
    
    if (stats.averageSpeedMs <= this.config.fastThresholdMs) {
      return 'fast';
    } else if (stats.averageSpeedMs >= this.config.slowThresholdMs) {
      return 'slow';
    }
    return null;
  }

  /**
   * Check if player has active streak
   */
  hasActiveStreak(stats: PlayerStats): boolean {
    return stats.streakCorrect >= this.config.streakThreshold;
  }

  /**
   * Reset all player stats (for new game)
   */
  reset(): void {
    this.playerStatsMap.clear();
  }
}
