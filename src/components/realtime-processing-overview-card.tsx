
// src/components/realtime-processing-overview-card.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Operation, Transaction } from '@/types/transaction-analyzer';
import { Icons } from './icons';
import { Badge } from './ui/badge';
import { getUniqueTransactionIds } from '@/lib/transaction-parser';
import { 
  operationsLogToMarkdown, 
  scheduleTimelineToMarkdown, 
  transactionSummariesToMarkdown 
} from '@/lib/table-to-markdown';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface RealtimeProcessingOverviewCardProps {
  parsedOperations: Operation[];
  parsedTransactions: Transaction[];
  scheduleInput: string;
  analysisPerformed: boolean;
}

export function RealtimeProcessingOverviewCard({
  parsedOperations,
  parsedTransactions,
  scheduleInput,
  analysisPerformed
}: RealtimeProcessingOverviewCardProps) {
  const { toast } = useToast();

  const getOperationTypeBadgeVariant = (type: Operation['type']) => {
    switch (type) {
      case 'R': return 'secondary';
      case 'W': return 'default';
      case 'C': return 'outline';
      case 'A': return 'destructive';
      default: return 'secondary';
    }
  };

  const scheduleTableTransactionIds = React.useMemo(() => {
    if (analysisPerformed && parsedOperations.length > 0) {
      return getUniqueTransactionIds(parsedOperations);
    }
    return [];
  }, [parsedOperations, analysisPerformed]);

  const getPlaceholderMessage = (section: string) => {
    if (!scheduleInput.trim() && !analysisPerformed) {
      return `Enter a schedule and click 'Run Analyzer' to see the ${section}.`;
    }
    if (scheduleInput.trim() && !analysisPerformed) {
      return `Click 'Run Analyzer' to process the current schedule for the ${section}.`;
    }
     if (analysisPerformed && parsedOperations.length === 0 && scheduleInput.trim()) {
       return `No operations found in the current schedule for the ${section}.`;
    }
     if (analysisPerformed && parsedOperations.length === 0 && !scheduleInput.trim()) {
       return `Schedule is empty. Enter operations and run analyzer for the ${section}.`;
    }
    return `${section} will appear here after analysis.`;
  };

  const handleCopyToClipboard = (content: string, type: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast({ title: 'Copied to Clipboard!', description: `${type} table copied as Markdown.` });
    }).catch(err => {
      toast({ title: 'Copy Failed', description: `Could not copy ${type} to clipboard. See console.`, variant: 'destructive' });
      console.error('Failed to copy Markdown: ', err);
    });
  };

  const handleDownloadMarkdown = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Download Started', description: `${type} table is downloading as ${filename}.` });
  };

  const renderExportButtons = (tableType: 'timeline' | 'log' | 'summary') => {
    let markdownContent = "";
    let filename = "";
    let tableDescription = "";

    if (!analysisPerformed || parsedOperations.length === 0) return null;

    switch (tableType) {
      case 'timeline':
        markdownContent = scheduleTimelineToMarkdown(parsedOperations, scheduleTableTransactionIds);
        filename = "schedule-timeline.md";
        tableDescription = "Timeline";
        if (scheduleTableTransactionIds.length === 0) return null;
        break;
      case 'log':
        markdownContent = operationsLogToMarkdown(parsedOperations);
        filename = "operations-log.md";
        tableDescription = "Operations Log";
        break;
      case 'summary':
        markdownContent = transactionSummariesToMarkdown(parsedTransactions);
        filename = "transaction-summaries.md";
        tableDescription = "Transaction Summaries";
        if (parsedTransactions.length === 0) return null;
        break;
      default:
        return null;
    }
    
    if (markdownContent.startsWith("No ") && markdownContent.endsWith(" to display.")) return null;


    return (
      <div className="flex gap-2 mt-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleCopyToClipboard(markdownContent, tableDescription)}
        >
          <Icons.ClipboardCopy className="mr-2 h-4 w-4" /> Copy Markdown
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleDownloadMarkdown(markdownContent, filename, tableDescription)}
        >
          <Icons.Download className="mr-2 h-4 w-4" /> Download .md
        </Button>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icons.FileClock className="mr-2 h-6 w-6" /> Schedule Overview &amp; Processing Log
        </CardTitle>
        <CardDescription>
          Overview of parsed operations, transaction summaries, and schedule visualization. Tables are scrollable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold text-lg mb-2">Schedule Visualization (Timeline)</h4>
          {analysisPerformed && parsedOperations.length > 0 && scheduleTableTransactionIds.length > 0 ? (
            <>
              <ScrollArea className="h-72 border rounded-md">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center sticky top-0 bg-card z-10 whitespace-nowrap px-2">Step</TableHead>
                      {scheduleTableTransactionIds.map(txId => (
                        <TableHead key={txId} className="text-center sticky top-0 bg-card z-10 whitespace-nowrap px-2 min-w-[80px]">{txId}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedOperations.map((op, stepIndex) => (
                      <TableRow key={op.id}>
                        <TableCell className="text-center font-medium whitespace-nowrap px-2">{stepIndex + 1}</TableCell>
                        {scheduleTableTransactionIds.map(txId => (
                          <TableCell key={`${op.id}-${txId}`} className="text-center font-mono text-xs h-10 whitespace-nowrap px-2">
                            {op.transactionId === txId ? op.originalString : ''}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {renderExportButtons('timeline')}
            </>
          ) : (
            <p className="p-4 text-center text-muted-foreground">
              {getPlaceholderMessage("schedule timeline")}
            </p>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-lg mb-2">Operations Log (Chronological)</h4>
          {analysisPerformed && parsedOperations.length > 0 ? (
            <>
              <ScrollArea className="h-48 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px] sticky top-0 bg-card z-10">Step</TableHead>
                      <TableHead className="w-[120px] sticky top-0 bg-card z-10">Transaction</TableHead>
                      <TableHead className="w-[100px] sticky top-0 bg-card z-10">Type</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Variable</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Full Operation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedOperations.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell>{op.step + 1}</TableCell>
                        <TableCell>{op.transactionId}</TableCell>
                        <TableCell>
                           <Badge variant={getOperationTypeBadgeVariant(op.type)} className={
                             op.type === 'C' ? 'bg-green-500 hover:bg-green-600 text-white' :
                             op.type === 'W' ? 'bg-primary text-primary-foreground' : ''
                           }>
                            {op.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{op.variable || 'N/A'}</TableCell>
                        <TableCell className="font-mono text-xs">{op.originalString}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {renderExportButtons('log')}
            </>
          ) : (
            <p className="p-4 text-center text-muted-foreground">{getPlaceholderMessage("operations log")}</p>
          )}
        </div>

        <div>
          <h4 className="font-semibold text-lg mb-2">Transaction Summaries</h4>
           {analysisPerformed && parsedTransactions.length > 0 ? (
            <>
              <ScrollArea className="h-40 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px] sticky top-0 bg-card z-10">Transaction ID</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Operations in Schedule</TableHead>
                      <TableHead className="sticky top-0 bg-card z-10">Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">{transaction.id}</TableCell>
                        <TableCell className="font-mono text-xs">
                           {transaction.operations.length > 0
                            ? transaction.operations.map(op => op.originalString).join('; ')
                            : 'None'
                          }
                        </TableCell>
                        <TableCell className="text-xs">{transaction.summary || 'No R/W/C/A operations yet.'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {renderExportButtons('summary')}
            </>
            ) : (
               <p className="p-4 text-center text-muted-foreground">{getPlaceholderMessage("transaction summaries")}</p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

