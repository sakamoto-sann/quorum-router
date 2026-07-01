import { ProcessExecutionError } from "../errors.ts";

const USD_EPSILON = 1e-9;

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type CircuitBreakerOptions = {
  failureThreshold: number;
  cooldownMs: number;
};

export interface BudgetManager {
  consume(label: string, amountUsd: number): void;
  snapshot(): { limitUsd: number; spentUsd: number; remainingUsd: number };
}

export class InMemoryBudgetManager implements BudgetManager {
  private readonly limitUsd: number;
  private spentUsd = 0;

  constructor(limitUsd: number) {
    if (!(limitUsd > 0)) {
      throw new Error("Budget limit must be > 0.");
    }

    this.limitUsd = limitUsd;
  }

  consume(label: string, amountUsd: number): void {
    if (!(amountUsd >= 0)) {
      throw new Error("amountUsd must be >= 0.");
    }

    if (this.spentUsd + amountUsd > this.limitUsd + USD_EPSILON) {
      throw new ProcessExecutionError(
        "budget_exhausted",
        `Budget exhausted before invoking ${label}. Remaining budget: ${
          (this.limitUsd - this.spentUsd).toFixed(4)
        } USD.`,
      );
    }

    this.spentUsd += amountUsd;
  }

  snapshot() {
    return {
      limitUsd: this.limitUsd,
      spentUsd: this.spentUsd,
      remainingUsd: this.limitUsd - this.spentUsd,
    };
  }
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(options: CircuitBreakerOptions) {
    if (
      !Number.isInteger(options.failureThreshold) ||
      options.failureThreshold < 1
    ) {
      throw new Error("failureThreshold must be an integer >= 1.");
    }
    if (!Number.isFinite(options.cooldownMs) || options.cooldownMs < 0) {
      throw new Error("cooldownMs must be a finite number >= 0.");
    }

    this.failureThreshold = options.failureThreshold;
    this.cooldownMs = options.cooldownMs;
  }

  assertAvailable(label: string): void {
    if (Date.now() < this.openUntil) {
      throw new ProcessExecutionError(
        "circuit_open",
        `${label} circuit open until ${
          new Date(this.openUntil).toISOString()
        }.`,
      );
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openUntil = Date.now() + this.cooldownMs;
    }
  }
}
