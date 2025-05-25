
// src/lib/two-phase-locking-analyzer.ts
'use server';

import type { Operation, Transaction, ScheduleAnalysisReport, TransactionCompliance, LockPhaseEvent } from '@/types/transaction-analyzer';

function getTransactionOperations(allOps: Operation[], transactionId: string): Operation[] {
  return allOps.filter(op => op.transactionId === transactionId).sort((a, b) => a.step - b.step);
}

function getOperationsByTransactionMap(allOps: Operation[]): Map<string, Operation[]> {
    const map = new Map<string, Operation[]>();
    for (const op of allOps) {
        if (!map.has(op.transactionId)) {
            map.set(op.transactionId, []);
        }
        map.get(op.transactionId)!.push(op);
    }
    map.forEach(ops => ops.sort((a,b) => a.step - b.step));
    return map;
}


function analyzeBasic2PL(
    txId: string,
    allOps: Operation[],
    txOps: Operation[],
    lockPhaseEvents: LockPhaseEvent[]
  ): boolean {
    let phase: 'growing' | 'shrinking' = 'growing';
    const locksHeldByTx = new Set<string>(); // Stores variables locked by this tx

    for (const op of allOps) { // Iterate through the full schedule to see interactions
        if (op.transactionId === txId) {
            // Operation is by the transaction being analyzed (Tx)
            if (op.type === 'R' || op.type === 'W') {
                if (phase === 'shrinking') {
                    lockPhaseEvents.push({ step: op.step, opString: op.originalString, action: `Attempt Lock on ${op.variable} (FAIL: Shrinking Phase)`, phase });
                    return false; // Lock acquired after shrinking phase started
                }
                const lockType = op.type === 'R' ? 'S' : 'X';
                locksHeldByTx.add(op.variable!);
                lockPhaseEvents.push({ step: op.step, opString: op.originalString, action: `Acquire ${lockType}-Lock(${op.variable})`, phase });
            } else if (op.type === 'C' || op.type === 'A') {
                if (phase === 'growing') { // Transition to shrinking if not already
                    phase = 'shrinking';
                }
                lockPhaseEvents.push({ step: op.step, opString: op.originalString, action: `Release All Locks (${op.type})`, phase });
                locksHeldByTx.clear(); // All locks released
                 // After commit/abort, the transaction should not perform more lock acquisitions.
                 // The main loop will catch this if further R/W ops for this tx exist.
            }
        } else {
            // Operation is by another transaction (Ty)
            if (phase === 'growing' && op.variable && locksHeldByTx.has(op.variable)) {
                // Tx holds a lock on op.variable, and Ty is operating on it.
                // Does Ty's operation conflict, implying Tx had to release its lock?
                // Simplified: any operation by Ty on a variable locked by Tx *could* imply Tx released it.
                // A more precise check needs lock compatibility (e.g. S-S is fine).
                // If Ty needs an X-lock, or Tx holds an X-lock, then Tx must have released.
                const txHeldLockTypeOp = txOps.findLast(txOp => txOp.variable === op.variable && (txOp.type === 'R' || txOp.type === 'W'));
                const txHeldLockType = txHeldLockTypeOp?.type === 'W' ? 'X' : 'S';
                
                const tyNeedsLockType = op.type === 'W' ? 'X' : 'S';

                if (txHeldLockType === 'X' || tyNeedsLockType === 'X') {
                    // If Tx holds X-lock, or Ty needs X-lock, they are incompatible.
                    // Tx must have released this lock for Ty to proceed.
                    // This means Tx has entered its shrinking phase.
                    lockPhaseEvents.push({ step: op.step, opString: `${op.originalString} (by ${op.transactionId})`, action: `Implied release of lock on ${op.variable} by ${txId} (due to conflict). ${txId} enters shrinking.`, phase: 'growing' });
                    phase = 'shrinking';
                    // Note: Tx doesn't *actually* lose the lock from locksHeldByTx for its own future ops yet,
                    // but its ability to acquire *new* locks is now restricted.
                }
            }
        }
         // Update phase for subsequent events in this step for this Tx
        const lastEventForTxInThisStep = lockPhaseEvents.filter(e => e.step === op.step && allOps.find(mainOp => mainOp.step === e.step && mainOp.transactionId === txId));
        if (lastEventForTxInThisStep.length > 0) {
            lastEventForTxInThisStep[lastEventForTxInThisStep.length - 1].phase = phase;
        }
    }
    return true; // Passed Basic 2PL
}


function analyzeStrict2PL(
    txId: string,
    allOps: Operation[],
    txOps: Operation[],
    isBasic2PL: boolean,
    lockPhaseEvents: LockPhaseEvent[]
): boolean {
    if (!isBasic2PL) return false;

    const commitOrAbortOp = txOps.find(op => op.type === 'C' || op.type === 'A');
    if (!commitOrAbortOp) {
        // Transaction does not commit or abort; Strict 2PL cannot be definitively determined unless schedule ends.
        // Assume it holds locks till end for now.
        // Or, if it has write ops, it must eventually commit/abort to be strict.
        // If it has writes and doesn't C/A, it's not Strict 2PL in a practical sense.
        const hasWrites = txOps.some(op => op.type === 'W');
        if (hasWrites) {
             const lastTxOp = txOps.length > 0 ? txOps[txOps.length-1] : null;
             if (lastTxOp) {
                const eventToUpdate = lockPhaseEvents.find(e => e.step === lastTxOp.step && e.opString === lastTxOp.originalString);
                if (eventToUpdate) {
                    eventToUpdate.action += ` (Strict 2PL Fail: Writes exist but no C/A by ${txId})`;
                } else {
                    // Add a new event if one doesn't exist for the last operation
                    lockPhaseEvents.push({step: lastTxOp.step, opString: lastTxOp.originalString, action: `(Strict 2PL Fail: Writes exist but no C/A by ${txId})`, phase: 'Shrinking'});
                }
             }
             return false;
        }
        return true; // No writes, vacuously true regarding X-locks.
    }
    const commitOrAbortStep = commitOrAbortOp.step;

    for (const writeOp of txOps.filter(op => op.type === 'W')) {
        const variable = writeOp.variable!;
        // Check if any other transaction accesses this variable before txId commits/aborts
        for (let k = writeOp.step + 1; k < commitOrAbortStep; k++) {
            const otherOp = allOps[k];
            if (otherOp && otherOp.transactionId !== txId && otherOp.variable === variable && (otherOp.type === 'R' || otherOp.type === 'W')) {
                // Strict 2PL violation: Tx released X-lock on 'variable' before commit/abort.
                const eventToUpdate = lockPhaseEvents.find(e => e.step === writeOp.step && e.opString === writeOp.originalString);
                if (eventToUpdate) {
                    eventToUpdate.action += ` (Strict 2PL Fail: ${otherOp.originalString} accessed ${variable} before ${txId} ${commitOrAbortOp.type})`;
                }
                return false;
            }
        }
    }
    return true;
}

function analyzeRigorous2PL(
    txId: string,
    allOps: Operation[],
    txOps: Operation[],
    isStrict2PL: boolean, // Rigorous implies Strict
    lockPhaseEvents: LockPhaseEvent[]
): boolean {
    if (!isStrict2PL) return false; // If not Strict, cannot be Rigorous

    const commitOrAbortOp = txOps.find(op => op.type === 'C' || op.type === 'A');
    if (!commitOrAbortOp) {
        // Similar to Strict 2PL, if ops exist and no C/A, it's problematic for Rigorous.
         const hasAccesses = txOps.some(op => op.type === 'R' || op.type === 'W');
         if (hasAccesses) {
            const lastTxOp = txOps.length > 0 ? txOps[txOps.length-1] : null;
            if (lastTxOp) {
                const eventToUpdate = lockPhaseEvents.find(e => e.step === lastTxOp.step && e.opString === lastTxOp.originalString);
                if(eventToUpdate) {
                     eventToUpdate.action += ` (Rigorous 2PL Fail: Accesses exist but no C/A by ${txId})`;
                } else {
                    lockPhaseEvents.push({step: lastTxOp.step, opString: lastTxOp.originalString, action: `(Rigorous 2PL Fail: Accesses exist but no C/A by ${txId})`, phase: 'Shrinking'});
                }
            }
            return false;
         }
        return true; // No R/W ops, vacuously true.
    }
    const commitOrAbortStep = commitOrAbortOp.step;

    for (const accessOp of txOps.filter(op => op.type === 'R' || op.type === 'W')) {
        const variable = accessOp.variable!;
        const heldLockType = accessOp.type === 'W' ? 'X' : 'S';

        // Check if any other transaction makes a conflicting access before txId commits/aborts
        for (let k = accessOp.step + 1; k < commitOrAbortStep; k++) {
            const otherOp = allOps[k];
            if (otherOp && otherOp.transactionId !== txId && otherOp.variable === variable) {
                const otherOpNeedsLockType = otherOp.type === 'W' ? 'X' : 'S';
                // Conflict if: heldLock is X, OR otherOpNeeds X
                if (heldLockType === 'X' || otherOpNeedsLockType === 'X') {
                     // Rigorous 2PL violation: Tx released S or X lock prematurely.
                    const eventToUpdate = lockPhaseEvents.find(e => e.step === accessOp.step && e.opString === accessOp.originalString);
                    if(eventToUpdate) eventToUpdate.action += ` (Rigorous 2PL Fail: ${otherOp.originalString} conflict access on ${variable} before ${txId} ${commitOrAbortOp.type})`;
                    return false;
                }
            }
        }
    }
    return true;
}


function analyzeCascadeless(allOps: Operation[], opsByTx: Map<string, Operation[]>): boolean {
    for (const currentOp of allOps) {
        if (currentOp.type === 'R' && currentOp.variable) {
            const readerTxId = currentOp.transactionId;
            const readVariable = currentOp.variable;
            const readStep = currentOp.step;

            // Find the latest preceding write to the same variable by a *different* transaction
            let latestWriterTxId: string | null = null;
            let latestWriteStep = -1;

            for (const prevOp of allOps) {
                if (prevOp.step >= readStep) continue; // Only look at preceding ops

                if (prevOp.type === 'W' && prevOp.variable === readVariable && prevOp.transactionId !== readerTxId) {
                    if (prevOp.step > latestWriteStep) {
                        latestWriteStep = prevOp.step;
                        latestWriterTxId = prevOp.transactionId;
                    }
                }
            }

            if (latestWriterTxId) { // Found a W_i(X) ... R_j(X) pattern
                const writerOps = opsByTx.get(latestWriterTxId);
                if (!writerOps) continue; // Should not happen if opsByTx is built correctly

                const writerCommitOp = writerOps.find(op => op.type === 'C');
                const writerAbortOp = writerOps.find(op => op.type === 'A');

                if (writerAbortOp && writerAbortOp.step < readStep) {
                    // Writer aborted before reader read. This is fine for cascadeless (no dirty read).
                    continue;
                }

                if (!writerCommitOp || writerCommitOp.step > readStep) {
                    // Writer did not commit before reader read the data.
                    return false; // Not cascadeless
                }
            }
        }
    }
    return true; // All reads satisfy cascadeless condition
}


export async function analyzeScheduleFor2PL(
  allOperations: Operation[],
  transactions: Transaction[] // Used to get all transaction IDs
): Promise<ScheduleAnalysisReport> {
  const report: ScheduleAnalysisReport = {
    transactionCompliance: {},
    isCascadeless: true,
    allowsCascadingAborts: false,
  };

  const transactionIds = transactions.map(t => t.id);
  const opsByTx = getOperationsByTransactionMap(allOperations);

  if (allOperations.length === 0) { // Handle empty schedule
    transactionIds.forEach(txId => {
        report.transactionCompliance[txId] = {
            basic2PL: true, strict2PL: true, rigorous2PL: true, conservative2PL: true, lockPhaseEvents: [{step: -1, opString: "No ops", action: "N/A", phase: 'Growing'}]
        };
    });
    report.isCascadeless = true;
    report.allowsCascadingAborts = false;
    return report;
  }


  for (const txId of transactionIds) {
    const txOps = opsByTx.get(txId) || [];
    if (txOps.length === 0) {
        report.transactionCompliance[txId] = {
            basic2PL: true, strict2PL: true, rigorous2PL: true, conservative2PL: true, lockPhaseEvents: [{step: -1, opString: "No ops", action: "N/A", phase: 'Growing'}]
        };
        continue;
    }

    const compliance: TransactionCompliance = {
      basic2PL: false,
      strict2PL: false,
      rigorous2PL: false,
      conservative2PL: false, // Simplified: Pass if Basic2PL passes + note
      lockPhaseEvents: [],
    };

    compliance.basic2PL = analyzeBasic2PL(txId, allOperations, txOps, compliance.lockPhaseEvents);
    compliance.strict2PL = analyzeStrict2PL(txId, allOperations, txOps, compliance.basic2PL, compliance.lockPhaseEvents);
    compliance.rigorous2PL = analyzeRigorous2PL(txId, allOperations, txOps, compliance.strict2PL, compliance.lockPhaseEvents);
    
    // Simplified Conservative 2PL check:
    // True C2PL means pre-claiming all locks. We can't see pre-claims.
    // We'll state it passes if Basic 2PL passes, with a note about pre-claiming.
    compliance.conservative2PL = compliance.basic2PL; 
    // Add a note event for conservative 2PL if needed in the card.

    // Ensure lockPhaseEvents are sorted by step, then by original order if multiple events at same step
    compliance.lockPhaseEvents.sort((a, b) => {
        if (a.step !== b.step) return a.step - b.step;
        // For events within the same step, try to maintain original operation order logic if possible
        // This might need more refined event generation if order within step is critical for display
        return 0; 
    });


    report.transactionCompliance[txId] = compliance;
  }

  report.isCascadeless = analyzeCascadeless(allOperations, opsByTx);
  report.allowsCascadingAborts = !report.isCascadeless;

  return report;
}

