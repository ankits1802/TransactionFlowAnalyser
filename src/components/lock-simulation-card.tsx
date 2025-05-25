
'use client';

import type { Dispatch, SetStateAction } from 'react';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Icons } from '@/components/icons';
import type { Operation, Lock, TransactionStatus, LockSimulationStep } from '@/types/transaction-analyzer';
import { LockManager } from '@/lib/lock-manager';
import { Badge } from '@/components/ui/badge';

interface LockSimulationCardProps {
  operations: Operation[];
  transactionIds: string[];
  scheduleInput: string;
  analysisPerformed: boolean;
}

export function LockSimulationCard({ operations, transactionIds, scheduleInput, analysisPerformed }: LockSimulationCardProps) {
  const [lockManager, setLockManager] = useState<LockManager | null>(null);
  const [currentSimulation, setCurrentSimulation] = useState<LockSimulationStep | undefined>(undefined);
  const [simulationComplete, setSimulationComplete] = useState(false);

  useEffect(() => {
    // Only initialize or reset lock manager if analysis has been performed and operations are available
    if (analysisPerformed && operations.length > 0) {
      const newLockManager = new LockManager(operations);
      setLockManager(newLockManager);
      setCurrentSimulation(newLockManager.getCurrentSimulationStep());
      setSimulationComplete(false);
    } else {
      // If analysis not performed or no operations, clear the simulation
      setLockManager(null);
      setCurrentSimulation(undefined);
      setSimulationComplete(false);
    }
  }, [operations, analysisPerformed]); // Depend on operations and analysisPerformed

  const handleNextStep = () => {
    if (lockManager && lockManager.canProceed()) {
      const stepResult = lockManager.nextStep();
      setCurrentSimulation(stepResult);
      if (!lockManager.canProceed()) {
        setSimulationComplete(true);
      }
    } else {
      setSimulationComplete(true);
    }
  };

  const handleReset = () => {
    if (lockManager) {
      lockManager.reset(); 
      setCurrentSimulation(lockManager.getCurrentSimulationStep());
      setSimulationComplete(false);
    } else if (analysisPerformed && operations.length > 0) { 
      // This case handles if the lock manager was null (e.g. due to no prior analysis)
      // but now analysis is done and operations exist.
      const newLockManager = new LockManager(operations);
      setLockManager(newLockManager);
      setCurrentSimulation(newLockManager.getCurrentSimulationStep());
      setSimulationComplete(false);
    }
  };
  
  const getStatusColor = (status: TransactionStatus) => {
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Blocked': return 'bg-yellow-500';
      case 'Committed': return 'bg-blue-500';
      case 'Aborted': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPlaceholderMessage = () => {
    if (!scheduleInput.trim() && !analysisPerformed) {
      return "Enter a schedule and click 'Run Analyzer' to start simulation.";
    }
    if (scheduleInput.trim() && !analysisPerformed) {
      return "Click 'Run Analyzer' to process the current schedule for simulation.";
    }
    if (analysisPerformed && operations.length === 0 && scheduleInput.trim()) {
       return "No operations found in the current schedule to simulate.";
    }
    if (analysisPerformed && operations.length === 0 && !scheduleInput.trim()) {
       return "Schedule is empty. Enter operations and run analyzer for simulation.";
    }
    return "Simulation details will appear here after running the analyzer.";
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icons.Simulation className="mr-2 h-6 w-6" /> Lock Simulation (Strict 2PL)
        </CardTitle>
        <CardDescription>Step through the schedule to see lock acquisitions, releases, and potential deadlocks.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysisPerformed || operations.length === 0 ? (
           <div className="h-[400px] flex items-center justify-center text-muted-foreground p-4 text-center">
             {getPlaceholderMessage()}
           </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button onClick={handleNextStep} disabled={!lockManager || simulationComplete || currentSimulation?.isDeadlock}>
                <Icons.NextStep className="mr-2 h-4 w-4" /> Next Step
              </Button>
              <Button onClick={handleReset} variant="outline" disabled={!lockManager && operations.length === 0}>
                <Icons.Reset className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>

            {currentSimulation?.isDeadlock && (
              <div className="p-4 bg-destructive/20 border border-destructive rounded-md text-destructive-foreground font-semibold">
                DEADLOCK DETECTED! Simulation halted. Reset to try again or modify schedule.
              </div>
            )}
            {simulationComplete && !currentSimulation?.isDeadlock && (
              <div className="p-4 bg-green-500/20 border border-green-700 rounded-md text-green-700 font-semibold">
                Simulation Complete. All operations processed or queue empty.
              </div>
            )}

            {currentSimulation && (
              <>
                <div>
                  <h4 className="font-semibold mb-1">Current Operation:</h4>
                  <p className="font-mono p-2 bg-muted rounded-md">
                    {currentSimulation.operation ? currentSimulation.operation.originalString : 'Initial State / Waiting'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-1">Lock Table:</h4>
                    <ScrollArea className="h-48 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Transaction</TableHead>
                            <TableHead>Variable</TableHead>
                            <TableHead>Lock Type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentSimulation.locks.length > 0 ? currentSimulation.locks.map((lock, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{lock.transactionId}</TableCell>
                              <TableCell>{lock.variable}</TableCell>
                              <TableCell>
                                <Badge variant={lock.type === 'S' ? 'secondary' : 'default'}>
                                  {lock.type === 'S' ? 'Shared (S)' : 'Exclusive (X)'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No locks held.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Transaction Statuses:</h4>
                    <ScrollArea className="h-48 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Transaction</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactionIds.length > 0 ? transactionIds.map(txId => (
                            <TableRow key={txId}>
                              <TableCell>{txId}</TableCell>
                              <TableCell>
                                <Badge className={`${getStatusColor(currentSimulation.transactionStatuses[txId] || 'Active')} text-white`}>
                                  {currentSimulation.transactionStatuses[txId] || 'Active'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) : <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No transactions analyzed.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
                
                {currentSimulation.waitingQueue.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-1">Waiting Queue:</h4>
                    <ScrollArea className="h-32 border rounded-md p-2 text-sm">
                      {currentSimulation.waitingQueue.map((item, idx) => (
                        <p key={idx} className="font-mono p-1">
                          {item.transactionId} waiting for {item.lockType}-lock on {item.variable} (Op: {item.operation.originalString})
                        </p>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-1">Log:</h4>
                  <ScrollArea className="h-32 border rounded-md p-2 text-sm bg-muted">
                    {currentSimulation.log.map((msg, idx) => (
                      <p key={idx} className="font-mono">{msg}</p>
                    ))}
                  </ScrollArea>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
