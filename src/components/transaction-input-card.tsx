
'use client';

import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import type { Transaction } from '@/types/transaction-analyzer';
import { ScrollArea } from './ui/scroll-area';
import { PlayCircle } from 'lucide-react';


interface TransactionInputCardProps {
  schedule: string;
  setSchedule: (schedule: string) => void; // Modified to accept string directly
  numTransactions: number;
  setNumTransactions: Dispatch<SetStateAction<number>>;
  numVariables: number;
  setNumVariables: Dispatch<SetStateAction<number>>;
  onRunAnalysis: () => void;
  analysisPerformed: boolean;
}

const MAX_ITEMS = 10; // Max transactions/variables

export function TransactionInputCard({
  schedule,
  setSchedule,
  numTransactions,
  setNumTransactions,
  numVariables,
  setNumVariables,
  onRunAnalysis,
  analysisPerformed,
}: TransactionInputCardProps) {
  const [activeTransaction, setActiveTransaction] = useState<string>('T1');
  const [activeVariable, setActiveVariable] = useState<string>('A');

  const handleScheduleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setSchedule(e.target.value); // This will trigger clearing of analysis in HomePage
  };

  const addOperation = (opType: 'R' | 'W' | 'C' | 'A') => {
    let newOp = '';
    if (opType === 'R' || opType === 'W') {
      newOp = `${opType}${activeTransaction.substring(1)}(${activeVariable})`;
    } else {
      newOp = `${opType}${activeTransaction.substring(1)}`;
    }
    const currentSchedule = schedule.trim();
    const separator = currentSchedule && !currentSchedule.endsWith(';') && !currentSchedule.endsWith(',') ? '; ' : '';
    setSchedule(currentSchedule + separator + newOp);
  };
  
  const transactionOptions = Array.from({ length: MAX_ITEMS }, (_, i) => `T${i + 1}`);
  const variableOptions = Array.from({ length: MAX_ITEMS }, (_, i) => String.fromCharCode(65 + i)); // A, B, C, ... J


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Transaction Input</CardTitle>
        <CardDescription>Define your transaction schedule. Use R1(A), W2(B), C1, A2 format. Then click "Run Analyzer".</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="num-transactions">Transactions (1-{MAX_ITEMS})</Label>
            <Select value={numTransactions.toString()} onValueChange={(val) => {
              const newNum = parseInt(val);
              setNumTransactions(newNum);
              if (parseInt(activeTransaction.substring(1)) > newNum) {
                setActiveTransaction('T1');
              }
            }}>
              <SelectTrigger id="num-transactions">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_ITEMS }, (_, i) => i + 1).map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="num-variables">Variables (1-{MAX_ITEMS})</Label>
             <Select value={numVariables.toString()} onValueChange={(val) => {
                const newNum = parseInt(val);
                setNumVariables(newNum);
                const currentVarIndex = variableOptions.indexOf(activeVariable);
                if (currentVarIndex >= newNum) {
                    setActiveVariable(variableOptions[0]); 
                }
             }}>
              <SelectTrigger id="num-variables">
                <SelectValue placeholder="Select count" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_ITEMS }, (_, i) => i + 1).map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-input">Schedule</Label>
          <Textarea
            id="schedule-input"
            placeholder="e.g., R1(A); W2(B); C1; A2"
            value={schedule}
            onChange={handleScheduleTextChange}
            rows={6}
            className="font-mono"
          />
           <p className="text-xs text-muted-foreground mt-1">Separate operations with semicolons or spaces. Changes will require re-running the analyzer.</p>
        </div>
        
        <div className="space-y-2">
          <Label>Operation Toolbox</Label>
          <div className="flex items-center gap-2 mb-2">
            <Select value={activeTransaction} onValueChange={setActiveTransaction}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Tx" />
              </SelectTrigger>
              <SelectContent>
                {transactionOptions.slice(0, numTransactions).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={activeVariable} onValueChange={setActiveVariable}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Var" />
              </SelectTrigger>
              <SelectContent>
                {variableOptions.slice(0, numVariables).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              {(['R', 'W', 'C', 'A'] as const).map((opType) => {
                const Icon = opType === 'R' ? Icons.Read : opType === 'W' ? Icons.Write : opType === 'C' ? Icons.Commit : Icons.Abort;
                const label = opType === 'R' ? 'Read' : opType === 'W' ? 'Write' : opType === 'C' ? 'Commit' : 'Abort';
                return (
                  <Tooltip key={opType}>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => addOperation(opType)}>
                        <Icon className="mr-2 h-4 w-4" /> {label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Insert {label} operation for {activeTransaction} { (opType === 'R' || opType === 'W') ? `on ${activeVariable}` : ''}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        <Button onClick={onRunAnalysis} className="w-full" disabled={!schedule.trim()}>
            <PlayCircle className="mr-2 h-5 w-5" /> Run Analyzer
        </Button>

      </CardContent>
    </Card>
  );
}

