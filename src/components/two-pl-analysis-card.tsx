
// src/components/two-pl-analysis-card.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { ScheduleAnalysisReport, TransactionCompliance, LockPhaseEvent } from '@/types/transaction-analyzer';
import { Icons } from './icons'; // Assuming you have a relevant icon

interface TwoPlAnalysisCardProps {
  analysisReport: ScheduleAnalysisReport | null;
  scheduleInput: string;
  analysisPerformed: boolean;
}

function ComplianceBadge({ compliant }: { compliant: boolean }) {
  return compliant ? (
    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Pass</Badge>
  ) : (
    <Badge variant="destructive">Fail</Badge>
  );
}

export function TwoPlAnalysisCard({ analysisReport, scheduleInput, analysisPerformed }: TwoPlAnalysisCardProps) {
  
  const getPlaceholderMessage = () => {
    if (!scheduleInput.trim() && !analysisPerformed) {
      return "Enter a schedule and click 'Run Analyzer' to see 2PL compliance and recoverability analysis.";
    }
    if (scheduleInput.trim() && !analysisPerformed) {
      return "Click 'Run Analyzer' to process the current schedule for 2PL analysis.";
    }
    if (analysisPerformed && !analysisReport) { // report is null or empty
       return "No operations found or analysis could not be performed for 2PL report.";
    }
    return "2PL analysis details will appear here after running the analyzer.";
  };

  if (!analysisPerformed || !analysisReport || Object.keys(analysisReport.transactionCompliance).length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icons.Lock className="mr-2 h-6 w-6" /> 2PL Compliance & Recoverability
          </CardTitle>
          <CardDescription>
            Analysis of schedule compliance with Two-Phase Locking protocols and recoverability properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground p-4 text-center">
            {getPlaceholderMessage()}
          </div>
        </CardContent>
      </Card>
    );
  }

  const transactionIds = Object.keys(analysisReport.transactionCompliance);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
           <Icons.Lock className="mr-2 h-6 w-6" /> 2PL Compliance & Recoverability
        </CardTitle>
        <CardDescription>
          Analysis of schedule compliance with Two-Phase Locking protocols and recoverability properties.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold text-lg mb-2">Schedule Properties:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              Cascadeless (ACA): <ComplianceBadge compliant={analysisReport.isCascadeless} />
            </div>
            <div>
              Allows Cascading Aborts: <ComplianceBadge compliant={!analysisReport.allowsCascadingAborts} /> 
              <span className="text-xs text-muted-foreground"> (Note: 'Pass' means it does NOT allow them)</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-lg mb-2">Transaction Compliance Details:</h4>
          {transactionIds.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {transactionIds.map(txId => {
                const compliance = analysisReport.transactionCompliance[txId];
                if (!compliance) return null;
                return (
                  <AccordionItem value={txId} key={txId}>
                    <AccordionTrigger className="hover:no-underline">
                        <span className="font-medium text-base">Transaction {txId}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Protocol</TableHead>
                            <TableHead>Compliance</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>Basic 2PL</TableCell>
                            <TableCell><ComplianceBadge compliant={compliance.basic2PL} /></TableCell>
                            <TableCell>All lock acquisitions precede first lock release.</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Strict 2PL</TableCell>
                            <TableCell><ComplianceBadge compliant={compliance.strict2PL} /></TableCell>
                            <TableCell>Basic 2PL + Exclusive locks held until Commit/Abort.</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Rigorous 2PL</TableCell>
                            <TableCell><ComplianceBadge compliant={compliance.rigorous2PL} /></TableCell>
                            <TableCell>Strict 2PL + All locks (S & X) held until Commit/Abort.</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Conservative 2PL</TableCell>
                            <TableCell><ComplianceBadge compliant={compliance.conservative2PL} /></TableCell>
                            <TableCell>Simplified: Basic 2PL. (Assumes pre-claim of all locks, prevents deadlocks).</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                      
                      <h5 className="font-semibold mt-3 text-sm">Inferred Lock Phases & Operations:</h5>
                      {compliance.lockPhaseEvents.length > 0 ? (
                        <ScrollArea className="h-40 border rounded-md p-2 bg-muted/50">
                          <ul className="space-y-1">
                            {compliance.lockPhaseEvents.map((event, idx) => (
                              <li key={idx} className="font-mono text-xs p-1 rounded bg-background shadow-sm">
                                <span className="font-semibold">Op: {event.opString}</span> (Step {event.step})
                                <br />
                                &nbsp;&nbsp;Action: {event.action}
                                <br />
                                &nbsp;&nbsp;Phase: <Badge variant={event.phase === 'Growing' ? 'secondary' : 'outline'} size="sm">{event.phase}</Badge>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      ) : (
                        <p className="text-xs text-muted-foreground">No operations or lock events for this transaction.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground">No transactions to analyze.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
