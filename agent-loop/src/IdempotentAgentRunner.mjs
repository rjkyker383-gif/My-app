const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class IdempotentAgentRunner {
  constructor(store, { waitTimeoutMs = 30000, pollMs = 5 } = {}) {
    this.store = store;
    this.waitTimeoutMs = waitTimeoutMs;
    this.pollMs = pollMs;
  }

  async execute(idempotencyKey, request, work) {
    const claim = this.store.reserveCycle(idempotencyKey, request);

    if (claim.kind === 'conflict') {
      const error = new Error('Idempotency key reused with a different request');
      error.code = 'IDEMPOTENCY_CONFLICT';
      throw error;
    }

    if (claim.kind === 'new') {
      try {
        const result = await work(claim.cycle.cycleNumber);
        this.store.completeCycle(claim.cycle.cycleNumber, result);
        return { replayed: false, cycleNumber: claim.cycle.cycleNumber, result };
      } catch (error) {
        this.store.failCycle(claim.cycle.cycleNumber, error);
        throw error;
      }
    }

    const deadline = Date.now() + this.waitTimeoutMs;
    while (Date.now() < deadline) {
      const current = this.store.getByIdempotencyKey(idempotencyKey);
      if (!current) throw new Error('Reserved cycle disappeared');

      if (current.status === 'succeeded') {
        return { replayed: true, cycleNumber: current.cycleNumber, result: current.state };
      }

      if (current.status === 'failed') {
        const error = new Error('Original idempotent execution failed');
        error.code = 'ORIGINAL_EXECUTION_FAILED';
        error.cycle = current;
        throw error;
      }

      if (current.status === 'interrupted') {
        const error = new Error('Original idempotent execution was interrupted; refusing automatic replay');
        error.code = 'ORIGINAL_EXECUTION_INTERRUPTED';
        error.cycle = current;
        throw error;
      }

      await sleep(this.pollMs);
    }

    const error = new Error('Timed out waiting for the original idempotent execution');
    error.code = 'IDEMPOTENCY_WAIT_TIMEOUT';
    throw error;
  }
}
