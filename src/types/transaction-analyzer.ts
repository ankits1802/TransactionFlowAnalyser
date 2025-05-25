
export type OperationType = 'R' | 'W' | 'C' | 'A';

export interface Operation {
  id: string; // Unique ID for the operation, e.g., "R1(X)-0"
  type: OperationType;
  transactionId: string; // e.g., "T1"
  variable?: string; // e.g., "X"
  originalString: string; // e.g., "R1(X)"
  step: number; // original index in schedule
}

export interface Transaction {
  id: string; // e.g., "T1"
  operations: Operation[];
  summary?: string;
}

export interface Conflict {
  op1: Operation;
  op2: Operation;
  type: 'RW' | 'WR' | 'WW';
  variable: string;
}

export interface GraphNode {
  id: string; // Transaction ID
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: string; // Transaction ID
  target: string; // Transaction ID
  label: string; // Conflict type and variable
  isCycleEdge?: boolean;
}

export interface Lock {
  transactionId: string;
  variable: string;
  type: 'S' | 'X'; // Shared or Exclusive
}

export type TransactionStatus = 'Active' | 'Blocked' | 'Committed' | 'Aborted';

export interface LockSimulationStep {
  operation: Operation | null;
  locks: Lock[];
  transactionStatuses: Record<string, TransactionStatus>;
  waitingQueue: { transactionId: string, operation: Operation, variable: string, lockType: 'S' | 'X' }[];
  log: string[]; // Log messages for this step
  isDeadlock: boolean;
}

// Types for 2PL and Recoverability Analysis
export interface LockPhaseEvent {
  step: number;
  opString: string;
  action: string; // e.g., "Acquire S-Lock(A)", "Release All Locks"
  phase: 'Growing' | 'Shrinking';
}

export interface TransactionCompliance {
  basic2PL: boolean;
  strict2PL: boolean;
  rigorous2PL: boolean;
  conservative2PL: boolean; // Simplified check
  lockPhaseEvents: LockPhaseEvent[];
}

export interface ScheduleAnalysisReport {
  transactionCompliance: Record<string, TransactionCompliance>; // Keyed by transactionId
  isCascadeless: boolean;
  allowsCascadingAborts: boolean; // Derived from isCascadeless
}
