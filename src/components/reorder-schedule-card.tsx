
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { reorderSchedule, type ReorderScheduleOutput } from '@/ai/flows/schedule-reordering'; // Adjust path as necessary
import { useToast } from '@/hooks/use-toast';

interface ReorderScheduleCardProps {
  currentSchedule: string;
  analysisPerformed: boolean; // To know if main analysis has run
}

export function ReorderScheduleCard({ currentSchedule, analysisPerformed }: ReorderScheduleCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReorderScheduleOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleReorder = async () => {
    if (!currentSchedule.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a schedule before reordering.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const output = await reorderSchedule({ schedule: currentSchedule });
      setResult(output);
      toast({
        title: "Schedule Reordered",
        description: "AI successfully reordered the schedule.",
      });
    } catch (e) {
      console.error("AI reordering failed:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during AI processing.";
      setError(errorMessage);
      toast({
        title: "Reordering Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Schedule Reordering</CardTitle>
        <CardDescription>
          Use generative AI to attempt reordering the current schedule into a conflict-serializable one.
          This works independently of the main analyzer's "Run" button.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleReorder} disabled={isLoading || !currentSchedule.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Reordering...
            </>
          ) : (
            'Reorder with AI'
          )}
        </Button>
        
        {!analysisPerformed && currentSchedule.trim() && (
            <Alert variant="default">
              <AlertTitle>Analyzer Not Run</AlertTitle>
              <AlertDescription>
                The main analyzer hasn't been run for the current schedule. AI reordering will use the raw schedule input.
                Consider running the main analyzer first for a complete overview.
              </AlertDescription>
            </Alert>
        )}


        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-1">Original Schedule:</h4>
              <Textarea value={currentSchedule} readOnly rows={3} className="font-mono bg-muted" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">AI Reordered Schedule:</h4>
              <Textarea value={result.reorderedSchedule} readOnly rows={3} className="font-mono bg-green-50 dark:bg-green-900/50" />
            </div>
            <div>
              <h4 className="font-semibold mb-1">Explanation:</h4>
              <Textarea value={result.explanation} readOnly rows={5} className="bg-blue-50 dark:bg-blue-900/50" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
