
// src/app/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TransactionInputCard } from '@/components/transaction-input-card';
import { ConflictGraphCard } from '@/components/conflict-graph-card';
import { ReorderScheduleCard } from '@/components/reorder-schedule-card';
import { LockSimulationCard } from '@/components/lock-simulation-card';
import { RealtimeProcessingOverviewCard } from '@/components/realtime-processing-overview-card';
import { TwoPlAnalysisCard } from '@/components/two-pl-analysis-card';
import { parseSchedule, groupOperationsByTransaction, getUniqueTransactionIds } from '@/lib/transaction-parser';
import { detectConflicts, buildPrecedenceGraph } from '@/lib/conflict-analyzer';
import { analyzeScheduleFor2PL } from '@/lib/two-phase-locking-analyzer';
// Using alias for consistency
import type { ViewSerializabilityDiscussionInput, ViewSerializabilityDiscussionOutput } from '@/ai/flows/view-serializability-discussion-flow';
import { discussViewSerializability } from '@/ai/flows/view-serializability-discussion-flow';
import type { Operation, Transaction, GraphNode, GraphEdge, Conflict, ScheduleAnalysisReport } from '@/types/transaction-analyzer';
import { Button } from '@/components/ui/button';
import { PlayCircle, Heart, Github, ExternalLink, ArrowLeft, Moon, Sun } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<string>('R1(X); W1(X); R2(X); W2(X); C1; C2');
  const [numTransactions, setNumTransactions] = useState<number>(2);
  const [numVariables, setNumVariables] = useState<number>(1);

  const [parsedOperations, setParsedOperations] = useState<Operation[]>([]);
  const [parsedTransactions, setParsedTransactions] = useState<Transaction[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; isSerializable: boolean; cycleEdges: GraphEdge[] }>({
    nodes: [],
    edges: [],
    isSerializable: true,
    cycleEdges: [],
  });
  const [analysisPerformed, setAnalysisPerformed] = useState<boolean>(false);
  const [twoPlReport, setTwoPlReport] = useState<ScheduleAnalysisReport | null>(null);
  const [viewSerializabilityDiscussionText, setViewSerializabilityDiscussionText] = useState<string | null>(null);
  const [isViewSerializabilityLoading, setIsViewSerializabilityLoading] = useState<boolean>(false);
  
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const uniqueTransactionIds = useMemo(() => getUniqueTransactionIds(parsedOperations), [parsedOperations]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleScheduleChange = useCallback((newSchedule: string) => {
    setSchedule(newSchedule);
    setAnalysisPerformed(false); 
    setParsedOperations([]);
    setParsedTransactions([]);
    setConflicts([]);
    setGraphData({ nodes: [], edges: [], isSerializable: true, cycleEdges: [] });
    setTwoPlReport(null);
    setViewSerializabilityDiscussionText(null);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (!schedule.trim()) {
      setParsedOperations([]);
      setParsedTransactions([]);
      setConflicts([]);
      setGraphData({ nodes: [], edges: [], isSerializable: true, cycleEdges: [] });
      setTwoPlReport(null);
      setViewSerializabilityDiscussionText(null);
      setAnalysisPerformed(true);
      return;
    }
    setViewSerializabilityDiscussionText(null); 
    setIsViewSerializabilityLoading(false);

    const operations = parseSchedule(schedule);
    setParsedOperations(operations);

    const localTransactions = groupOperationsByTransaction(operations); 
    setParsedTransactions(localTransactions);

    const detectedConflicts = detectConflicts(operations);
    setConflicts(detectedConflicts);
    
    const uniqueIds = getUniqueTransactionIds(operations);
    let currentGraphData = { nodes: [] as GraphNode[], edges: [] as GraphEdge[], isSerializable: true, cycleEdges: [] as GraphEdge[]};
    if (uniqueIds.length > 0) {
        currentGraphData = buildPrecedenceGraph(uniqueIds, detectedConflicts);
        setGraphData(currentGraphData);
    } else {
        setGraphData({ nodes: [], edges: [], isSerializable: true, cycleEdges: [] });
    }

    if (operations.length > 0 && localTransactions.length > 0) {
      const report = await analyzeScheduleFor2PL(operations, localTransactions);
      setTwoPlReport(report);
    } else {
      setTwoPlReport(null);
    }

    setAnalysisPerformed(true);

    if (!currentGraphData.isSerializable && currentGraphData.cycleEdges.length > 0) {
      setIsViewSerializabilityLoading(true);
      try {
        const discussionInput: ViewSerializabilityDiscussionInput = {
          schedule: schedule,
          conflictCycleInfo: `Cycle detected involving transactions: ${currentGraphData.cycleEdges.map(e => `${e.source}->${e.target}`).join(', ')}`,
        };
        // Using a simplified call for the temporarily modified flow
        const discussionOutput = await discussViewSerializability(discussionInput);
        setViewSerializabilityDiscussionText(discussionOutput.discussion);
      } catch (error) {
        console.error("Error fetching view serializability discussion:", error);
        setViewSerializabilityDiscussionText("AI discussion on view serializability could not be loaded.");
      } finally {
        setIsViewSerializabilityLoading(false);
      }
    }
  }, [schedule]); 

  useEffect(() => {
    handleRunAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col items-center">
      <Button 
        variant="outline" 
        size="icon" 
        className="fixed top-4 left-4 z-50"
        onClick={() => router.push('https://ankits1802-autosql.vercel.app/')}
        aria-label="Go back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 right-4 z-50"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>
      <header className="w-full mt-8 mb-8 text-center">
        <h1 className="text-4xl font-bold text-primary">TransactionFlow Analyzer</h1>
        <p className="text-lg text-muted-foreground">
          Analyze, visualize, and understand transaction schedules and concurrency control.
        </p>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <TransactionInputCard
            schedule={schedule}
            setSchedule={handleScheduleChange}
            numTransactions={numTransactions}
            setNumTransactions={setNumTransactions}
            numVariables={numVariables}
            setNumVariables={setNumVariables}
            onRunAnalysis={handleRunAnalysis}
            analysisPerformed={analysisPerformed}
          />
        </div>
        
        <div className="lg:col-span-2">
            <RealtimeProcessingOverviewCard 
              parsedOperations={parsedOperations} 
              parsedTransactions={parsedTransactions} 
              scheduleInput={schedule}
              analysisPerformed={analysisPerformed}
            />
        </div>

        <ConflictGraphCard
          nodes={graphData.nodes}
          edges={graphData.edges}
          isSerializable={graphData.isSerializable}
          cycleEdges={graphData.cycleEdges}
          parsedTransactions={parsedTransactions}
          scheduleInput={schedule}
          analysisPerformed={analysisPerformed}
          viewSerializabilityDiscussionText={viewSerializabilityDiscussionText}
          isViewSerializabilityLoading={isViewSerializabilityLoading}
        />
        
        <ReorderScheduleCard 
          currentSchedule={schedule} 
          analysisPerformed={analysisPerformed} 
        />
        
        <div className="lg:col-span-2">
            <TwoPlAnalysisCard 
              analysisReport={twoPlReport}
              scheduleInput={schedule}
              analysisPerformed={analysisPerformed}
            />
        </div>

        <div className="lg:col-span-2">
            <LockSimulationCard 
              operations={parsedOperations} 
              transactionIds={uniqueTransactionIds}
              scheduleInput={schedule}
              analysisPerformed={analysisPerformed}
            />
        </div>

      </main>
      
       <footer className="w-full max-w-6xl mt-12 pt-6 border-t text-muted-foreground text-sm">
        <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
          <div className="mb-2 sm:mb-0">
            &copy; {new Date().getFullYear()} TransactionFlow Analyzer. All rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <span>Version 1.0.0</span>
            <span className="flex items-center">
              Made with <Heart className="w-4 h-4 mx-1 text-red-500 fill-current transition-all duration-300 ease-in-out hover:scale-150 hover:drop-shadow-[0_0_6px_#ef4444]" /> by AutoSQL Team
            </span>
            <a href="https://github.com/ankits1802/" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository" className="hover:text-primary">
              <Github className="w-5 h-5" />
            </a>
            <a href="ankits1802-autosql.vercel.app" target="_blank" rel="noopener noreferrer" aria-label="Project Website" className="hover:text-primary">
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
