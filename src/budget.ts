import { BudgetConfig, BudgetResult, SessionState } from './types.js';
import { loadConfig } from './config.js';
import { broadcastEvent, addAlert } from './dashboard-web.js';
import * as crypto from 'crypto';

export interface SessionBudgetState {
  sessionId: string;
  dailySpend: number;
  sessionSpend: number;
  callCount: number;
  dailyResetAt: Date;
}

const budgetStates = new Map<string, SessionBudgetState>();

function getNextMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function getTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return '0h 0m';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function getOrCreateState(sessionId: string): SessionBudgetState {
  if (!budgetStates.has(sessionId)) {
    budgetStates.set(sessionId, {
      sessionId,
      dailySpend: 0,
      sessionSpend: 0,
      callCount: 0,
      dailyResetAt: getNextMidnightUTC()
    });
  }
  return budgetStates.get(sessionId)!;
}

/**
 * Checks an incoming request cost against session and daily budgets.
 */
export function checkBudget(sessionId: string, incomingCost: number, config: BudgetConfig): BudgetResult {
  const state = getOrCreateState(sessionId);
  const now = new Date();

  // Reset daily spend if needed
  if (now > state.dailyResetAt) {
    state.dailySpend = 0;
    state.dailyResetAt = getNextMidnightUTC();
  }

  const projectedSessionSpend = state.sessionSpend + incomingCost;
  const projectedDailySpend = state.dailySpend + incomingCost;
  const time_until_reset = getTimeUntil(state.dailyResetAt);

  // Check session cap
  if (projectedSessionSpend > config.session_max_usd) {
    const reason = `Session budget exceeded. Projected: ${projectedSessionSpend.toFixed(2)} USD, Limit: ${config.session_max_usd} USD`;
    addAlert({ id: crypto.randomUUID(), type: 'budget_alert', severity: 'critical', message: reason, timestamp: Date.now() });
    broadcastEvent({
      type: 'budget_alert',
      data: { severity: 'critical', current: projectedSessionSpend, limit: config.session_max_usd, percent: (projectedSessionSpend/config.session_max_usd)*100, timestamp: Date.now() }
    });
    return {
      allowed: false,
      reason,
      current_spend_usd: state.sessionSpend,
      limit_usd: config.session_max_usd,
      time_until_reset
    };
  }

  // Check daily cap
  if (projectedDailySpend > config.daily_max_usd) {
    const reason = `Daily budget exceeded. Projected: ${projectedDailySpend.toFixed(2)} USD, Limit: ${config.daily_max_usd} USD`;
    addAlert({ id: crypto.randomUUID(), type: 'budget_alert', severity: 'critical', message: reason, timestamp: Date.now() });
    broadcastEvent({
      type: 'budget_alert',
      data: { severity: 'critical', current: projectedDailySpend, limit: config.daily_max_usd, percent: (projectedDailySpend/config.daily_max_usd)*100, timestamp: Date.now() }
    });
    return {
      allowed: false,
      reason,
      current_spend_usd: state.dailySpend,
      limit_usd: config.daily_max_usd,
      time_until_reset
    };
  }

  // Record the spend locally
  state.sessionSpend = projectedSessionSpend;
  state.dailySpend = projectedDailySpend;
  state.callCount += 1;

  // 80% warning check
  if (projectedDailySpend > config.daily_max_usd * 0.8) {
    const reason = `Warning: You have used over 80% of your daily budget (${projectedDailySpend.toFixed(2)} / ${config.daily_max_usd} USD)`;
    addAlert({ id: crypto.randomUUID(), type: 'budget_warning', severity: 'warning', message: reason, timestamp: Date.now() });
    broadcastEvent({
      type: 'budget_warning',
      data: { severity: 'warning', current: projectedDailySpend, limit: config.daily_max_usd, percent: (projectedDailySpend/config.daily_max_usd)*100, timestamp: Date.now() }
    });
    return {
      allowed: true,
      reason,
      current_spend_usd: state.dailySpend,
      limit_usd: config.daily_max_usd,
      time_until_reset
    };
  }

  return {
    allowed: true,
    current_spend_usd: state.dailySpend,
    limit_usd: config.daily_max_usd,
    time_until_reset
  };
}

export function resetDailyBudget(sessionId?: string): void {
  if (sessionId) {
    const state = getOrCreateState(sessionId);
    state.dailySpend = 0;
    state.dailyResetAt = getNextMidnightUTC();
  } else {
    for (const state of budgetStates.values()) {
      state.dailySpend = 0;
      state.dailyResetAt = getNextMidnightUTC();
    }
  }
}

export function resetSessionBudget(sessionId: string): void {
  const state = getOrCreateState(sessionId);
  state.sessionSpend = 0;
  state.callCount = 0;
}

export function getBudgetStatus(sessionId: string): { dailySpend: number; dailyCap: number; sessionSpend: number; sessionCap: number; percentage: number } {
  const state = getOrCreateState(sessionId);
  const config = loadConfig().budget;
  
  const percentage = config.daily_max_usd > 0 
    ? (state.dailySpend / config.daily_max_usd) * 100 
    : 0;

  return {
    dailySpend: state.dailySpend,
    dailyCap: config.daily_max_usd,
    sessionSpend: state.sessionSpend,
    sessionCap: config.session_max_usd,
    percentage
  };
}

// Auto-reset check every minute
setInterval(() => {
  const now = new Date();
  for (const [sessionId, state] of budgetStates.entries()) {
    if (now > state.dailyResetAt) {
      state.dailySpend = 0;
      state.dailyResetAt = getNextMidnightUTC();
    }
  }
}, 60 * 1000).unref();
