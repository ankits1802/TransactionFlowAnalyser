// src/components/icons.tsx
import type { LucideProps } from 'lucide-react';
import { Eye, Edit3, CheckCircle2, XCircle, Workflow, Lock, Unlock, ListChecks, RotateCcw, Play, ZoomIn, ZoomOut, Download, FileText, FileClock, Settings2, Palette, MousePointerSquareDashed, Move, ClipboardCopy } from 'lucide-react';

export const Icons = {
  Read: Eye,
  Write: Edit3,
  Commit: CheckCircle2,
  Abort: XCircle,
  ConflictGraph: Workflow,
  Lock: Lock,
  Unlock: Unlock,
  Simulation: ListChecks,
  Reset: RotateCcw,
  NextStep: Play,
  ZoomIn: ZoomIn,
  ZoomOut: ZoomOut,
  Download: Download,
  FileText: FileText, // Can be used for SVG download
  FileClock: FileClock,
  Settings: Settings2,
  Palette: Palette,
  MousePointerSquare: MousePointerSquareDashed, // Changed from MousePointerSquare
  Move: Move,
  ClipboardCopy: ClipboardCopy,
};

export const TransactionIcon = (props: LucideProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

// Add other custom icons if needed
