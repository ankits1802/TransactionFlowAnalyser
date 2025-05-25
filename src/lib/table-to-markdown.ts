// src/lib/table-to-markdown.ts
import type { Operation, Transaction } from '@/types/transaction-analyzer';

export function operationsLogToMarkdown(operations: Operation[]): string {
  if (!operations || operations.length === 0) return "No operations to display.";

  let markdown = "| Step | Transaction | Type | Variable | Full Operation |\n";
  markdown +=    "| :--- | :---------- | :--- | :------- | :------------- |\n";
  operations.forEach(op => {
    markdown += `| ${op.step + 1} | ${op.transactionId} | ${op.type} | ${op.variable || 'N/A'} | \`${op.originalString}\` |\n`;
  });
  return markdown;
}

export function scheduleTimelineToMarkdown(operations: Operation[], transactionIds: string[]): string {
  if (!operations || operations.length === 0 || !transactionIds || transactionIds.length === 0) return "No schedule data to display.";

  let header = "| Step |";
  let separator = "| :--- |";
  transactionIds.forEach(txId => {
    header += ` ${txId} |`;
    separator += ` :---: |`; // Center align transaction columns
  });
  header += "\n";
  separator += "\n";

  let body = "";
  operations.forEach((op, stepIndex) => {
    let row = `| ${stepIndex + 1} |`;
    transactionIds.forEach(txId => {
      if (op.transactionId === txId) {
        row += ` \`${op.originalString}\` |`;
      } else {
        row += "  |"; // Empty cell
      }
    });
    row += "\n";
    body += row;
  });

  return header + separator + body;
}

export function transactionSummariesToMarkdown(transactions: Transaction[]): string {
  if (!transactions || transactions.length === 0) return "No transaction summaries to display.";

  let markdown = "| Transaction ID | Operations in Schedule | Summary |\n";
  markdown +=    "| :------------- | :--------------------- | :------ |\n";
  transactions.forEach(t => {
    const opsString = t.operations.length > 0 
      ? t.operations.map(op => `\`${op.originalString}\``).join('; ') 
      : 'None';
    markdown += `| ${t.id} | ${opsString} | ${t.summary || 'No R/W/C/A operations yet.'} |\n`;
  });
  return markdown;
}
