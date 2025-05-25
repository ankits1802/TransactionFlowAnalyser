import type { Operation, Transaction, OperationType } from '@/types/transaction-analyzer';

export const parseSchedule = (scheduleString: string): Operation[] => {
  const operations: Operation[] = [];
  if (!scheduleString.trim()) {
    return operations;
  }

  // Normalize by replacing various separators with semicolons, then split
  const opStrings = scheduleString
    .trim()
    .replace(/[,;\s]+/g, ';') // Replace commas, multiple semicolons, or spaces with a single semicolon
    .split(';')
    .filter(op => op.trim() !== '');

  opStrings.forEach((opStr, index) => {
    opStr = opStr.trim().toUpperCase();
    const match = opStr.match(/^([RWCA])(\d+)(?:\(([^)]+)\))?$/);
    if (match) {
      const type = match[1] as OperationType;
      const transactionNum = match[2];
      const variable = match[3] || undefined;
      const transactionId = `T${transactionNum}`;
      
      operations.push({
        id: `${opStr}-${index}`,
        type,
        transactionId,
        variable,
        originalString: opStr,
        step: index,
      });
    } else {
      // Consider how to handle invalid operations, e.g., throw error or mark as invalid
      console.warn(`Invalid operation string: ${opStr}`);
    }
  });
  return operations;
};

export const groupOperationsByTransaction = (operations: Operation[]): Transaction[] => {
  const transactionsMap = new Map<string, Transaction>();
  operations.forEach(op => {
    if (!transactionsMap.has(op.transactionId)) {
      transactionsMap.set(op.transactionId, { id: op.transactionId, operations: [] });
    }
    transactionsMap.get(op.transactionId)!.operations.push(op);
  });

  const transactions = Array.from(transactionsMap.values());
  
  transactions.forEach(t => {
    t.summary = generateTransactionSummary(t);
  });
  
  return transactions;
};

const generateTransactionSummary = (transaction: Transaction): string => {
  let reads = 0;
  let writes = 0;
  let commits = 0;
  let aborts = 0;

  transaction.operations.forEach(op => {
    if (op.transactionId === transaction.id) { // Ensure operation belongs to this transaction summary
      switch (op.type) {
        case 'R': reads++; break;
        case 'W': writes++; break;
        case 'C': commits++; break;
        case 'A': aborts++; break;
      }
    }
  });

  const parts: string[] = [];
  if (reads > 0) parts.push(`${reads} Read${reads > 1 ? 's' : ''}`);
  if (writes > 0) parts.push(`${writes} Write${writes > 1 ? 's' : ''}`);
  
  let summary = `${transaction.id}: `;
  if (parts.length > 0) {
    summary += parts.join(', ');
  } else {
    summary += "No R/W operations";
  }

  if (commits > 0) summary += (parts.length > 0 ? ', ' : '') + 'Commits';
  else if (aborts > 0) summary += (parts.length > 0 ? ', ' : '') + 'Aborts';
  else summary += (parts.length > 0 ? '.' : ', No Commit/Abort');


  return summary;
};

export const getUniqueTransactionIds = (operations: Operation[]): string[] => {
  return Array.from(new Set(operations.map(op => op.transactionId))).sort();
};

export const getUniqueVariableNames = (operations: Operation[]): string[] => {
  return Array.from(new Set(operations.filter(op => op.variable).map(op => op.variable!))).sort();
};
