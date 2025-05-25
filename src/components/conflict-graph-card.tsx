
// src/components/conflict-graph-card.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GraphNode, GraphEdge, Transaction } from '@/types/transaction-analyzer';
import { ConflictGraph } from './conflict-graph';
import { Icons } from './icons';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface ConflictGraphCardProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  isSerializable: boolean;
  cycleEdges: GraphEdge[];
  parsedTransactions: Transaction[];
  scheduleInput: string;
  analysisPerformed: boolean;
  viewSerializabilityDiscussionText: string | null;
  isViewSerializabilityLoading: boolean;
}

const SVG_ID = "conflict-graph-svg-export";

// Helper function to create a clone of the SVG with resolved styles
const getSvgWithResolvedColorsNode = (liveSvgNode: SVGSVGElement, svgElementId: string): SVGSVGElement => {
  const clonedSvgNode = liveSvgNode.cloneNode(true) as SVGSVGElement;

  if (!clonedSvgNode.getAttribute('xmlns')) {
    clonedSvgNode.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  clonedSvgNode.setAttribute('id', `${svgElementId}-cloned`); // Ensure clone has a different ID

  // Ensure viewBox is copied
  if (liveSvgNode.hasAttribute('viewBox') && !clonedSvgNode.hasAttribute('viewBox')) {
    clonedSvgNode.setAttribute('viewBox', liveSvgNode.getAttribute('viewBox')!);
  }
   if (liveSvgNode.hasAttribute('width') && !clonedSvgNode.hasAttribute('width')) {
    clonedSvgNode.setAttribute('width', liveSvgNode.getAttribute('width')!);
  }
  if (liveSvgNode.hasAttribute('height') && !clonedSvgNode.hasAttribute('height')) {
    clonedSvgNode.setAttribute('height', liveSvgNode.getAttribute('height')!);
  }


  const processElements = (selector: string, type: 'circle' | 'line' | 'text' | 'polygon') => {
    const originalElements = liveSvgNode.querySelectorAll(selector);
    originalElements.forEach(origEl => {
      const elId = origEl.id;
      if (!elId) return;

      const clonedEl = clonedSvgNode.querySelector(`#${CSS.escape(elId)}`);
      if (clonedEl) {
        const style = window.getComputedStyle(origEl);
        
        const fill = style.getPropertyValue('fill');
        const stroke = style.getPropertyValue('stroke');
        const strokeWidth = style.getPropertyValue('stroke-width');

        if (fill && fill !== 'none' && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') {
          (clonedEl as SVGElement).setAttribute('fill', fill);
        } else {
          (clonedEl as SVGElement).setAttribute('fill', 'transparent');
        }

        if (stroke && stroke !== 'none' && stroke !== 'rgba(0, 0, 0, 0)' && stroke !== 'transparent') {
          (clonedEl as SVGElement).setAttribute('stroke', stroke);
        } else {
           if (type === 'line') (clonedEl as SVGElement).setAttribute('stroke', 'rgb(100,100,100)'); 
           else if (type === 'polygon' && style.getPropertyValue('fill') === 'none') (clonedEl as SVGElement).setAttribute('stroke', 'rgb(100,100,100)');
           else if (type === 'circle' && style.getPropertyValue('stroke-width') === '0px') (clonedEl as SVGElement).setAttribute('stroke', 'rgb(100,100,100)');
        }
        
        if (strokeWidth && strokeWidth !== '0px' && strokeWidth !== '0' && strokeWidth.trim() !== "") {
            (clonedEl as SVGElement).setAttribute('stroke-width', strokeWidth);
        } else {
            if (type === 'line' || type === 'circle') (clonedEl as SVGElement).setAttribute('stroke-width', '1px'); 
        }

        if (type === 'text') {
          const textEl = clonedEl as SVGTextElement;
          const origTextEl = origEl as SVGTextElement;
          
          textEl.setAttribute('font-family', style.getPropertyValue('font-family') || 'sans-serif');
          textEl.setAttribute('font-size', style.getPropertyValue('font-size') || '10px');
          textEl.setAttribute('font-weight', style.getPropertyValue('font-weight') || 'normal');
          textEl.setAttribute('text-anchor', origTextEl.getAttribute('text-anchor') || style.getPropertyValue('text-anchor') || 'middle');
          textEl.setAttribute('dominant-baseline', origTextEl.getAttribute('dominant-baseline') || style.getPropertyValue('dominant-baseline') || 'auto');
          textEl.setAttribute('dy', origTextEl.getAttribute('dy') || style.getPropertyValue('dy') || '0');
          
          const textFill = style.getPropertyValue('fill');
          if ((!textFill || textFill === 'none' || textFill === 'rgba(0, 0, 0, 0)' || textFill === 'transparent') && origTextEl.textContent && origTextEl.textContent.trim() !== '') {
            textEl.setAttribute('fill', 'rgb(50,50,50)'); 
          } else if (textFill) {
            textEl.setAttribute('fill', textFill);
          }


          if (origTextEl.textContent) {
            textEl.textContent = origTextEl.textContent;
          } else {
            textEl.textContent = ''; 
          }
        }
         (clonedEl as SVGElement).removeAttribute('style');
      }
    });
  };

  processElements(`svg#${CSS.escape(SVG_ID)} circle[id^="node-circle-"]`, 'circle');
  processElements(`svg#${CSS.escape(SVG_ID)} line[id^="edge-line-"]`, 'line');
  processElements(`svg#${CSS.escape(SVG_ID)} text[id^="node-text-"]`, 'text');
  processElements(`svg#${CSS.escape(SVG_ID)} text[id^="edge-text-"]`, 'text');
  
  // Process all arrowhead polygons by querying for polygons within defs that have an ID starting with "arrowhead-" and ending with the svgId
  // This is more robust if new arrowhead types are added.
  const markerPolygons = liveSvgNode.querySelectorAll(`defs marker[id$="-${CSS.escape(SVG_ID)}"] polygon`);
  markerPolygons.forEach(origPoly => {
    const polyId = origPoly.id;
    if(!polyId) return;

    const clonedPoly = clonedSvgNode.querySelector(`#${CSS.escape(polyId)}`);
    if (clonedPoly) {
        const style = window.getComputedStyle(origPoly);
        const fill = style.getPropertyValue('fill');
        if (fill && fill !== 'none' && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent') {
            (clonedPoly as SVGPolygonElement).setAttribute('fill', fill);
        } else {
            (clonedPoly as SVGPolygonElement).setAttribute('fill', 'rgb(50,50,50)'); // Default fill if none
        }
        (clonedPoly as SVGPolygonElement).removeAttribute('style'); // Remove inline styles after applying
    }
  });
  
  return clonedSvgNode;
};


export function ConflictGraphCard({ 
  nodes: initialNodesFromAnalysis, 
  edges, 
  isSerializable, 
  cycleEdges, 
  parsedTransactions,
  scheduleInput,
  analysisPerformed,
  viewSerializabilityDiscussionText,
  isViewSerializabilityLoading,
}: ConflictGraphCardProps) {
  const [graphScale, setGraphScale] = useState(1);
  const { toast } = useToast();
  
  const handleZoomIn = () => setGraphScale(s => Math.min(s * 1.2, 3));
  const handleZoomOut = () => setGraphScale(s => Math.max(s / 1.2, 0.2));
  const handleResetView = () => {
    setGraphScale(1);
    toast({ title: "View Reset", description: "Graph zoom has been reset. Pan reset might require interaction if graph was panned manually." });
  };

  const downloadSVG = () => {
    const svgNode = document.getElementById(SVG_ID) as SVGSVGElement | null;
    if (!svgNode) {
      toast({ title: "Error", description: "Graph SVG element not found.", variant: "destructive" });
      return;
    }
    const processedSvgNode = getSvgWithResolvedColorsNode(svgNode, SVG_ID);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(processedSvgNode);
    
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "conflict-graph.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Graph downloaded as SVG." });
  };

  const handleDownloadPNG = () => {
    const svgNode = document.getElementById(SVG_ID) as SVGSVGElement | null;
    if (!svgNode) {
      toast({ title: "Error", description: "Graph SVG element not found for PNG.", variant: "destructive" });
      return;
    }

    const processedSvgNode = getSvgWithResolvedColorsNode(svgNode, SVG_ID);
    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(processedSvgNode);
    
    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    const canvas = document.createElement('canvas');
    const viewBox = processedSvgNode.getAttribute('viewBox');
    let baseWidth = 600, baseHeight = 400; 

    if (viewBox) {
        const parts = viewBox.split(' ').map(Number);
        if (parts.length === 4) {
            baseWidth = parts[2];
            baseHeight = parts[3];
        }
    } else if (processedSvgNode.hasAttribute('width') && processedSvgNode.hasAttribute('height')) {
        baseWidth = parseInt(processedSvgNode.getAttribute('width')!, 10);
        baseHeight = parseInt(processedSvgNode.getAttribute('height')!, 10);
    }


    const exportScale = 2; 
    canvas.width = baseWidth * exportScale;
    canvas.height = baseHeight * exportScale;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast({ title: "Error", description: "Could not get canvas context for PNG.", variant: "destructive" });
      return;
    }

    const img = new Image();
    img.onload = () => {
      let cardBgColor = 'white'; 
      
      const liveSvgCard = svgNode.closest('.bg-card') || document.documentElement;
      const liveCardStyle = window.getComputedStyle(liveSvgCard);
      cardBgColor = liveCardStyle.getPropertyValue('background-color');
      
      if (cardBgColor === 'rgba(0, 0, 0, 0)' || cardBgColor === 'transparent') {
          const rootStyle = window.getComputedStyle(document.documentElement);
          const cardHslRaw = rootStyle.getPropertyValue('--card').trim();
          if (cardHslRaw) {
              // Convert HSL string like "39 100% 97%" to "hsl(39, 100%, 97%)"
              const [h, s, l] = cardHslRaw.split(' ');
              if (h && s && l) cardBgColor = `hsl(${h}, ${s}, ${l})`;
              else cardBgColor = 'white'; // Fallback
          } else {
            cardBgColor = 'white'; // Final fallback
          }
      }
      
      ctx.fillStyle = cardBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = 'conflict-graph.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(img.src); 
      toast({ title: "Success", description: "Graph downloaded as PNG." });
    };
    img.onerror = (e) => {
      console.error("Image load error for PNG:", e, "SVG string:", svgString);
      toast({ title: "Error", description: "Could not load SVG to image for PNG. Check console.", variant: "destructive" });
      if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); 
    };
    
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    img.src = URL.createObjectURL(svgBlob);
  };
  
  const getPlaceholderMessage = () => {
    if (!scheduleInput.trim() && !analysisPerformed) {
      return "Enter a schedule and click 'Run Analyzer' to see the conflict graph.";
    }
    if (scheduleInput.trim() && !analysisPerformed) {
      return "Click 'Run Analyzer' to process the current schedule and see the graph.";
    }
    if (analysisPerformed && initialNodesFromAnalysis.length === 0 && scheduleInput.trim()) {
       return "No transactions or conflicts found in the current schedule to build a graph.";
    }
     if (analysisPerformed && initialNodesFromAnalysis.length === 0 && !scheduleInput.trim()) {
       return "Schedule is empty. Enter operations and run analyzer.";
    }
    return "Graph will appear here after analysis.";
  };

  const hasGraphData = analysisPerformed && scheduleInput.trim() && initialNodesFromAnalysis.length > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center">
              <Icons.ConflictGraph className="mr-2 h-6 w-6" /> Conflict Precedence Graph
            </CardTitle>
            <CardDescription>
              Interactive: Drag nodes, pan graph. Cycles indicate non-serializability. Colors: RW (teal), WR (orange), WW (purple), Cycle (red).
            </CardDescription>
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-1 flex-wrap justify-end">
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleZoomIn} disabled={!hasGraphData}><Icons.ZoomIn /></Button></TooltipTrigger><TooltipContent><p>Zoom In</p></TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleZoomOut} disabled={!hasGraphData}><Icons.ZoomOut /></Button></TooltipTrigger><TooltipContent><p>Zoom Out</p></TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleResetView} disabled={!hasGraphData}><Icons.MousePointerSquare /></Button></TooltipTrigger><TooltipContent><p>Reset View (Zoom/Pan)</p></TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={handleDownloadPNG} disabled={!hasGraphData}><Icons.Download /></Button></TooltipTrigger><TooltipContent><p>Download as PNG</p></TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={downloadSVG} disabled={!hasGraphData}><Icons.FileText /></Button></TooltipTrigger><TooltipContent><p>Download as SVG</p></TooltipContent></Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasGraphData && (
          <div className="flex justify-center items-center mb-4">
            {isSerializable ? (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-base px-4 py-2">Serializable</Badge>
            ) : (
              <Badge variant="destructive" className="text-base px-4 py-2">Not Serializable (Cycle Detected)</Badge>
            )}
          </div>
        )}
        
        <div className="flex justify-center items-center min-h-[400px]">
         { hasGraphData ? (
            <ConflictGraph 
              initialNodes={initialNodesFromAnalysis} 
              edges={edges} 
              currentScale={graphScale} 
              svgId={SVG_ID}
              width={600} 
              height={400}
              analysisPerformed={analysisPerformed} 
              scheduleInput={scheduleInput}       
            />
          ) : (
            <div className="h-[400px] w-full flex items-center justify-center text-muted-foreground p-4 text-center border rounded-md bg-muted/50">
              {getPlaceholderMessage()}
            </div>
          )}
        </div>

        {analysisPerformed && scheduleInput.trim() && (initialNodesFromAnalysis.length > 0 || !isSerializable) && (
          <div className="space-y-2">
            <h4 className="font-semibold text-lg">Serializability Explanation:</h4>
            {isSerializable ? (
              <p className="text-sm text-muted-foreground">
                The schedule is <strong>conflict serializable</strong> because its conflict precedence graph contains no cycles. 
                This implies that there is at least one equivalent serial schedule (e.g., obtained via a topological sort of the graph).
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  The schedule is <strong>not conflict serializable</strong> because its conflict precedence graph contains one or more cycles. 
                  A cycle (e.g., T<sub>i</sub> → T<sub>j</sub> and T<sub>j</sub> → T<sub>i</sub>) indicates a circular dependency where an operation in T<sub>i</sub> conflicts with and precedes an operation in T<sub>j</sub>, 
                  and an operation in T<sub>j</sub> (or a sequence of operations through other transactions) conflicts with and precedes an operation in T<sub>i</sub>. 
                  This makes it impossible to find an equivalent serial order for the transactions.
                </p>
                {cycleEdges.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-destructive mt-2">Detected Cycle Path(s) involving:</h5>
                    <ul className="text-sm text-destructive list-disc list-inside font-mono">
                      {cycleEdges.map((edge, i) => (
                          <li key={`cycle-edge-${i}`}>
                             {edge.source} → {edge.target} 
                             <span className="text-xs text-muted-foreground"> (due to {edge.label})</span>
                          </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isViewSerializabilityLoading && (
                   <Alert variant="default" className="mt-4">
                     <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                     <AlertTitle>AI Analyzing View Serializability...</AlertTitle>
                     <AlertDescription>
                       Please wait while the AI provides insights on view serializability for this non-conflict-serializable schedule.
                     </AlertDescription>
                   </Alert>
                )}
                {viewSerializabilityDiscussionText && !isViewSerializabilityLoading && (
                  <Alert variant="default" className="mt-4">
                    <AlertTitle className="font-semibold">AI Discussion on View Serializability:</AlertTitle>
                    <AlertDescription>
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {viewSerializabilityDiscussionText}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        )}
        
        {analysisPerformed && parsedTransactions.length > 0 && (
          <div className="space-y-2 mt-6">
            <h4 className="font-semibold text-lg">Transaction Operations in Schedule:</h4>
            <ScrollArea className="h-48 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Transaction</TableHead>
                    <TableHead>Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {transaction.operations.length > 0 
                          ? transaction.operations.map(op => op.originalString).join('; ')
                          : 'No operations in schedule.'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

