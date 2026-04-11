export type MetricsSnapshot = {
  activeRooms: number;
  activeSockets: number;
  moveCount: number;
  errorCount: number;
  avgMoveLatencyMs: number;
  blockchainSubmitSuccessCount: number;
  blockchainSubmitFailureCount: number;
  blockchainSubmitRetryCount: number;
};

class MetricsRegistry {
  private activeRooms = 0;
  private activeSockets = 0;
  private moveCount = 0;
  private errorCount = 0;
  private moveLatencyTotalMs = 0;
  private blockchainSubmitSuccessCount = 0;
  private blockchainSubmitFailureCount = 0;
  private blockchainSubmitRetryCount = 0;

  setActiveRooms(value: number): void {
    this.activeRooms = Math.max(0, value);
  }

  setActiveSockets(value: number): void {
    this.activeSockets = Math.max(0, value);
  }

  observeMoveLatency(latencyMs: number): void {
    this.moveCount += 1;
    this.moveLatencyTotalMs += Math.max(0, latencyMs);
  }

  incrementError(): void {
    this.errorCount += 1;
  }

  incrementBlockchainSubmitSuccess(): void {
    this.blockchainSubmitSuccessCount += 1;
  }

  incrementBlockchainSubmitFailure(): void {
    this.blockchainSubmitFailureCount += 1;
  }

  incrementBlockchainSubmitRetry(): void {
    this.blockchainSubmitRetryCount += 1;
  }

  snapshot(): MetricsSnapshot {
    return {
      activeRooms: this.activeRooms,
      activeSockets: this.activeSockets,
      moveCount: this.moveCount,
      errorCount: this.errorCount,
      avgMoveLatencyMs: this.moveCount === 0 ? 0 : this.moveLatencyTotalMs / this.moveCount,
      blockchainSubmitSuccessCount: this.blockchainSubmitSuccessCount,
      blockchainSubmitFailureCount: this.blockchainSubmitFailureCount,
      blockchainSubmitRetryCount: this.blockchainSubmitRetryCount,
    };
  }
}

export const metrics = new MetricsRegistry();
