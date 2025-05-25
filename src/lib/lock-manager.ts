import type { Operation, Lock, TransactionStatus, LockSimulationStep } from '@/types/transaction-analyzer';

export class LockManager {
  private operations: Operation[];
  private currentStepIndex: number;
  private locks: Lock[];
  private transactionStatuses: Record<string, TransactionStatus>;
  private waitingQueue: { transactionId: string, operation: Operation, variable: string, lockType: 'S' | 'X' }[];
  private history: LockSimulationStep[];
  private log: string[];

  constructor(operations: Operation[]) {
    this.operations = operations;
    this.currentStepIndex = -1;
    this.locks = [];
    this.transactionStatuses = {};
    this.waitingQueue = [];
    this.history = [];
    this.log = [];
    this.initializeTransactionStatuses();
    this.recordInitialStep();
  }

  private initializeTransactionStatuses() {
    const transactionIds = new Set(this.operations.map(op => op.transactionId));
    transactionIds.forEach(id => {
      this.transactionStatuses[id] = 'Active';
    });
  }
  
  private recordInitialStep() {
     this.history.push({
      operation: null,
      locks: [],
      transactionStatuses: { ...this.transactionStatuses },
      waitingQueue: [],
      log: ["Initial state."],
      isDeadlock: false,
    });
  }

  public getCurrentSimulationStep(): LockSimulationStep | undefined {
    return this.history[this.history.length -1];
  }

  public getAllSteps(): LockSimulationStep[] {
    return this.history;
  }
  
  public canProceed(): boolean {
    return this.currentStepIndex < this.operations.length - 1 || this.waitingQueue.length > 0;
  }

  public nextStep(): LockSimulationStep {
    this.log = []; // Clear log for the new step

    // First, try to process operations from the waiting queue
    if (this.processWaitingQueue()) {
      // If something was processed from waiting queue, that's this step
      const currentSimulationStep = {
        operation: this.history[this.history.length-1].operation, // Last processed operation
        locks: [...this.locks],
        transactionStatuses: { ...this.transactionStatuses },
        waitingQueue: [...this.waitingQueue],
        log: [...this.log],
        isDeadlock: this.detectDeadlock(),
      };
      this.history.push(currentSimulationStep);
      return currentSimulationStep;
    }
    
    // If waiting queue couldn't be processed, or is empty, try next operation from schedule
    if (this.currentStepIndex < this.operations.length - 1) {
      this.currentStepIndex++;
      const operation = this.operations[this.currentStepIndex];
      
      if (this.transactionStatuses[operation.transactionId] === 'Aborted' || this.transactionStatuses[operation.transactionId] === 'Committed') {
        this.log.push(`Skipping ${operation.originalString} for ${operation.transactionId} (already ${this.transactionStatuses[operation.transactionId]}).`);
      } else {
        this.processOperation(operation);
      }
    } else if (this.waitingQueue.length > 0 && !this.processWaitingQueue()) {
      // No more operations in schedule, but items in queue that cannot be processed (potential deadlock)
       this.log.push("No more operations in schedule. Waiting queue has items that cannot be processed.");
    } else {
       this.log.push("No more operations in schedule and waiting queue is empty. Simulation complete.");
    }
    
    const isDeadlock = this.detectDeadlock();
    if (isDeadlock) {
      this.log.push("DEADLOCK DETECTED!");
      // Basic deadlock resolution: Abort one of the transactions in the deadlock (e.g., youngest or random)
      // For simplicity, we'll just flag it and let UI handle it or stop simulation.
    }

    const currentSimulationStep = {
      operation: this.operations[this.currentStepIndex] || null,
      locks: [...this.locks],
      transactionStatuses: { ...this.transactionStatuses },
      waitingQueue: [...this.waitingQueue],
      log: [...this.log],
      isDeadlock,
    };
    this.history.push(currentSimulationStep);
    return currentSimulationStep;
  }
  
  private processOperation(operation: Operation) {
    const { type, transactionId, variable } = operation;

    if (this.transactionStatuses[transactionId] === 'Blocked' && !this.isTransactionReady(operation)) {
      this.log.push(`${transactionId} is blocked, cannot process ${operation.originalString} yet.`);
      // Re-add to front of queue if it was popped and couldn't proceed, or handle appropriately
      // This logic is simplified; a real system might re-queue differently.
      if(!this.waitingQueue.find(item => item.operation.id === operation.id)) {
        this.addToWaitingQueue(operation, variable, type === 'R' ? 'S' : 'X');
      }
      return;
    }


    switch (type) {
      case 'R':
        if (variable) this.requestLock(transactionId, variable, 'S', operation);
        break;
      case 'W':
        if (variable) this.requestLock(transactionId, variable, 'X', operation);
        break;
      case 'C':
        this.commitTransaction(transactionId);
        break;
      case 'A':
        this.abortTransaction(transactionId);
        break;
    }
  }
  
  private isTransactionReady(operation: Operation): boolean {
    // Check if the operation this transaction is waiting for can now proceed
    const waitingItem = this.waitingQueue.find(item => item.transactionId === operation.transactionId && item.operation.id === operation.id);
    if (waitingItem) {
      return this.canAcquireLock(waitingItem.transactionId, waitingItem.variable, waitingItem.lockType);
    }
    return true; // Not in waiting queue or ready
  }

  private requestLock(transactionId: string, variable: string, lockType: 'S' | 'X', operation: Operation) {
    if (this.canAcquireLock(transactionId, variable, lockType)) {
      this.grantLock(transactionId, variable, lockType);
      this.log.push(`${transactionId} acquired ${lockType}-lock on ${variable} for ${operation.originalString}.`);
      if (this.transactionStatuses[transactionId] === 'Blocked') {
        this.transactionStatuses[transactionId] = 'Active';
         this.log.push(`${transactionId} is now Active.`);
      }
    } else {
      this.log.push(`${transactionId} cannot acquire ${lockType}-lock on ${variable} for ${operation.originalString}. Added to waiting queue.`);
      this.transactionStatuses[transactionId] = 'Blocked';
      this.addToWaitingQueue(operation, variable, lockType);
    }
  }

  private canAcquireLock(transactionId: string, variable: string, lockType: 'S' | 'X'): boolean {
    const existingLocksOnVar = this.locks.filter(lock => lock.variable === variable);
    if (existingLocksOnVar.length === 0) return true;

    if (lockType === 'S') {
      // Can acquire S-lock if all existing locks on var are S-locks (can be from other transactions)
      return existingLocksOnVar.every(lock => lock.type === 'S');
    } else { // lockType === 'X'
      // Can acquire X-lock if no other transaction holds any lock on var, 
      // OR if this transaction already holds an X-lock (lock upgrade not explicitly handled here but implicitly allowed if it's the sole X-lock holder)
      // OR if this transaction holds an S-lock and it's the only S-lock holder (Strict 2PL might prevent this upgrade scenario without release)
      // For Strict 2PL, simpler: only grant if no locks from OTHERS or if current Tx holds X.
      return existingLocksOnVar.every(lock => lock.transactionId === transactionId && lock.type === 'X') ||
             !existingLocksOnVar.some(lock => lock.transactionId !== transactionId);
    }
  }

  private grantLock(transactionId: string, variable: string, lockType: 'S' | 'X') {
    // Remove any existing S-locks by this transaction on this variable if upgrading to X
    if (lockType === 'X') {
      this.locks = this.locks.filter(
        lock => !(lock.transactionId === transactionId && lock.variable === variable && lock.type === 'S')
      );
    }
    // Add the new lock if not already present (e.g. multiple reads for S lock)
    if (!this.locks.some(l => l.transactionId === transactionId && l.variable === variable && l.type === lockType)) {
       this.locks.push({ transactionId, variable, type: lockType });
    }
  }

  private releaseLocks(transactionId: string) {
    const releasedCount = this.locks.filter(lock => lock.transactionId === transactionId).length;
    this.locks = this.locks.filter(lock => lock.transactionId !== transactionId);
    if (releasedCount > 0) {
      this.log.push(`${transactionId} released ${releasedCount} lock(s).`);
    }
    // After releasing locks, check waiting queue
    this.processWaitingQueue();
  }
  
  private addToWaitingQueue(operation: Operation, variable: string, lockType: 'S' | 'X') {
    if (!this.waitingQueue.some(item => item.operation.id === operation.id)) {
       this.waitingQueue.push({ transactionId: operation.transactionId, operation, variable, lockType });
    }
  }
  
  private processWaitingQueue(): boolean {
    let processedAny = false;
    const initialQueueSize = this.waitingQueue.length;
    
    for (let i = 0; i < this.waitingQueue.length; i++) {
      const item = this.waitingQueue[i];
      if (this.canAcquireLock(item.transactionId, item.variable, item.lockType)) {
        this.grantLock(item.transactionId, item.variable, item.lockType);
        this.log.push(`${item.transactionId} (from waiting queue) acquired ${item.lockType}-lock on ${item.variable} for ${item.operation.originalString}.`);
        this.transactionStatuses[item.transactionId] = 'Active';
        this.log.push(`${item.transactionId} is now Active.`);
        this.waitingQueue.splice(i, 1); // Remove from queue
        i--; // Adjust index due to splice
        processedAny = true;
        // Potentially, process original operation or mark it as done.
        // For simplicity, we assume acquiring lock means this operation can now be considered "done" for lock purposes.
      }
    }
    return processedAny;
  }


  private commitTransaction(transactionId: string) {
    this.log.push(`${transactionId} Commits.`);
    this.releaseLocks(transactionId);
    this.transactionStatuses[transactionId] = 'Committed';
  }

  private abortTransaction(transactionId: string) {
    this.log.push(`${transactionId} Aborts.`);
    this.releaseLocks(transactionId);
    this.transactionStatuses[transactionId] = 'Aborted';
    // Remove pending operations of this transaction from waiting queue
    this.waitingQueue = this.waitingQueue.filter(item => item.transactionId !== transactionId);
  }

  // Basic deadlock detection: T1 waits for T2 (T2 holds lock T1 needs), T2 waits for T1 (T1 holds lock T2 needs)
  private detectDeadlock(): boolean {
    if (this.waitingQueue.length < 2) return false;

    for (const item1 of this.waitingQueue) {
      for (const item2 of this.waitingQueue) {
        if (item1.transactionId === item2.transactionId) continue;

        // T1 (item1.transactionId) waiting for resource locked by T2?
        const t1NeedsVar = item1.variable;
        const t2HoldsLockOnT1Var = this.locks.some(lock => lock.variable === t1NeedsVar && lock.transactionId === item2.transactionId && (lock.type === 'X' || item1.lockType === 'X'));

        if (t2HoldsLockOnT1Var) {
          // T2 (item2.transactionId) waiting for resource locked by T1?
          const t2NeedsVar = item2.variable;
          const t1HoldsLockOnT2Var = this.locks.some(lock => lock.variable === t2NeedsVar && lock.transactionId === item1.transactionId && (lock.type === 'X' || item2.lockType === 'X'));

          if (t1HoldsLockOnT2Var) {
            this.log.push(`Potential deadlock: ${item1.transactionId} needs ${t1NeedsVar} (held by ${item2.transactionId}), and ${item2.transactionId} needs ${t2NeedsVar} (held by ${item1.transactionId}).`);
            return true; // Found a simple A->B, B->A deadlock
          }
        }
      }
    }
    return false;
  }

  public reset(newOperations?: Operation[]) {
    if (newOperations) {
      this.operations = newOperations;
    }
    this.currentStepIndex = -1;
    this.locks = [];
    this.transactionStatuses = {};
    this.waitingQueue = [];
    this.history = [];
    this.log = [];
    this.initializeTransactionStatuses();
    this.recordInitialStep();
  }
}
