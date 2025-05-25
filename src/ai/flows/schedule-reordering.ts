// src/ai/flows/schedule-reordering.ts
'use server';

/**
 * @fileOverview Reorders a transaction schedule to achieve conflict serializability.
 *
 * - reorderSchedule - A function that reorders the schedule for conflict serializability.
 * - ReorderScheduleInput - The input type for the reorderSchedule function.
 * - ReorderScheduleOutput - The return type for the reorderSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReorderScheduleInputSchema = z.object({
  schedule: z
    .string()
    .describe(
      'The transaction schedule to reorder, represented as a string of operations, e.g., R1(X); W2(Y); C1; A2'
    ),
});
export type ReorderScheduleInput = z.infer<typeof ReorderScheduleInputSchema>;

const ReorderScheduleOutputSchema = z.object({
  reorderedSchedule: z
    .string()
    .describe(
      'The reordered transaction schedule that is conflict serializable.'
    ),
  explanation: z
    .string()
    .describe(
      'An explanation of the reordering process and why the new schedule is conflict serializable.'
    ),
});
export type ReorderScheduleOutput = z.infer<typeof ReorderScheduleOutputSchema>;

export async function reorderSchedule(input: ReorderScheduleInput): Promise<ReorderScheduleOutput> {
  return reorderScheduleFlow(input);
}

const reorderSchedulePrompt = ai.definePrompt({
  name: 'reorderSchedulePrompt',
  input: {schema: ReorderScheduleInputSchema},
  output: {schema: ReorderScheduleOutputSchema},
  prompt: `You are a database expert tasked with reordering transaction schedules to ensure conflict serializability.

  Given the following transaction schedule, reorder the operations to create a conflict-serializable schedule.
  Explain the reordering process and why the new schedule is conflict serializable.

  Schedule: {{{schedule}}}

  Respond with the reordered schedule and the explanation.
  `,
});

const reorderScheduleFlow = ai.defineFlow(
  {
    name: 'reorderScheduleFlow',
    inputSchema: ReorderScheduleInputSchema,
    outputSchema: ReorderScheduleOutputSchema,
  },
  async input => {
    const {output} = await reorderSchedulePrompt(input);
    return output!;
  }
);
