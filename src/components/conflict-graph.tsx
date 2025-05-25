// src/components/conflict-graph.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GraphNode, GraphEdge } from '@/types/transaction-analyzer';

interface ConflictGraphProps {
  initialNodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  currentScale?: number;
  svgId?: string;
  onNodeDrag?: (nodeId: string, x: number, y: number) => void;
  // Added to satisfy ConflictGraphCard's usage, even if not used internally for analysis
  analysisPerformed?: boolean; 
  scheduleInput?: string;
}

export function ConflictGraph({
  initialNodes,
  edges,
  width = 600,
  height = 400,
  currentScale = 1,
  svgId = "conflict-graph-svg",
  onNodeDrag,
  analysisPerformed, // Consuming the prop
  scheduleInput,   // Consuming the prop
}: ConflictGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
  const [dragNodeStart, setDragNodeStart] = useState<{ x: number, y: number, nodeX: number, nodeY: number } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number, y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let processedInitialNodes = [...initialNodes];
    if (processedInitialNodes.length > 0) {
        const allAtOrigin = processedInitialNodes.every(n => n.x === 0 && n.y === 0);
        if (processedInitialNodes.length === 1 && allAtOrigin) {
            processedInitialNodes[0].x = width / 2;
            processedInitialNodes[0].y = height / 2;
        } else if (allAtOrigin && processedInitialNodes.length > 1) {
            const numNodes = processedInitialNodes.length;
            const radius = Math.min(width, height) / 3;
            const centerX = width / 2;
            const centerY = height / 2;
            processedInitialNodes = processedInitialNodes.map((node, i) => {
                const angle = (i / numNodes) * 2 * Math.PI;
                return {
                ...node,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                };
            });
        }
    }
    setNodes(processedInitialNodes);
    setPanOffset({ x: 0, y: 0 }); 
  }, [initialNodes, width, height]);


  const getEdgeColorStyle = (edge: GraphEdge): React.CSSProperties => {
    if (edge.isCycleEdge) return { stroke: 'hsl(var(--destructive))' };
    const typeMatch = edge.label.match(/^(RW|WR|WW)/);
    if (typeMatch) {
      const conflictType = typeMatch[0];
      if (conflictType === 'RW') return { stroke: 'hsl(var(--chart-2))' }; // Teal/Green
      if (conflictType === 'WR') return { stroke: 'hsl(var(--chart-4))' }; // Orange/Yellow
      if (conflictType === 'WW') return { stroke: 'hsl(var(--chart-5))' }; // Purple/Pink
    }
    return { stroke: 'hsl(var(--foreground))' }; // Default
  };
  
  const getArrowMarkerId = (edge: GraphEdge): string => {
    if (edge.isCycleEdge) return `url(#arrowhead-cycle-${svgId})`;
    const typeMatch = edge.label.match(/^(RW|WR|WW)/);
    if (typeMatch) {
      if (typeMatch[0] === 'RW') return `url(#arrowhead-rw-${svgId})`;
      if (typeMatch[0] === 'WR') return `url(#arrowhead-wr-${svgId})`;
      if (typeMatch[0] === 'WW') return `url(#arrowhead-ww-${svgId})`;
    }
    return `url(#arrowhead-default-${svgId})`;
  };


  const getSVGCoordinates = (event: React.MouseEvent | MouseEvent): { x: number, y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y:0 };
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleNodeMouseDown = (event: React.MouseEvent, nodeId: string) => {
    event.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const { x: svgMouseX, y: svgMouseY } = getSVGCoordinates(event);
    
    setIsDraggingNode(nodeId);
    setDragNodeStart({ 
      x: svgMouseX, 
      y: svgMouseY,
      nodeX: node.x, 
      nodeY: node.y 
    });
  };

  const handleSvgMouseDown = (event: React.MouseEvent) => {
    if (event.target === svgRef.current || 
        ((event.target as SVGElement).closest('svg') === svgRef.current && 
         !['circle', 'text', 'line', 'polygon'].includes((event.target as SVGElement).tagName.toLowerCase()))
       ) {
      const { x: svgMouseX, y: svgMouseY } = getSVGCoordinates(event);
      setIsPanning(true);
      setPanStart({ x: svgMouseX - panOffset.x, y: svgMouseY - panOffset.y });
    }
  };
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!svgRef.current) return;
    const { x: svgMouseX, y: svgMouseY } = getSVGCoordinates(event);

    if (isDraggingNode && dragNodeStart) {
      const dx = (svgMouseX - dragNodeStart.x) / currentScale;
      const dy = (svgMouseY - dragNodeStart.y) / currentScale;
      
      setNodes(prevNodes =>
        prevNodes.map(n =>
          n.id === isDraggingNode
            ? { ...n, x: dragNodeStart.nodeX + dx, y: dragNodeStart.nodeY + dy }
            : n
        )
      );
       if (onNodeDrag) { // Call onNodeDrag during move for live updates if needed elsewhere
           const updatedNode = nodes.find(n => n.id === isDraggingNode);
           if (updatedNode) { // This will use the node's state *before* the current setNodes updates
               onNodeDrag(updatedNode.id, dragNodeStart.nodeX + dx, dragNodeStart.nodeY + dy);
           }
       }
    } else if (isPanning && panStart) {
      setPanOffset({
        x: svgMouseX - panStart.x,
        y: svgMouseY - panStart.y,
      });
    }
  }, [isDraggingNode, dragNodeStart, isPanning, panStart, currentScale, nodes, onNodeDrag]);


  const handleMouseUp = useCallback(() => {
    // Final call to onNodeDrag with the settled position if it was being dragged.
    if (isDraggingNode && dragNodeStart && onNodeDrag) {
        const node = nodes.find(n => n.id === isDraggingNode);
        // The 'nodes' state might not be updated yet from the last handleMouseMove's setNodes.
        // So, calculate the final position directly from dragNodeStart and mouse position at mouseUp.
        // However, for simplicity and because setNodes from handleMouseMove should eventually update it,
        // we can use the latest 'nodes' state. If more precision is needed, recalculate here.
        if (node) {
            onNodeDrag(node.id, node.x, node.y);
        }
    }
    setIsDraggingNode(null);
    setDragNodeStart(null);
    setIsPanning(false);
    setPanStart(null);
  }, [isDraggingNode, dragNodeStart, nodes, onNodeDrag]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp); // Handle mouse leaving window

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Placeholder rendering logic based on props that are now passed but not used for this component's core rendering
   if (analysisPerformed === false && scheduleInput && scheduleInput.trim()) {
     return <div className="text-center text-muted-foreground p-4 h-[400px] flex items-center justify-center">Run analyzer to view graph.</div>;
   }
   if (analysisPerformed && scheduleInput && scheduleInput.trim() && initialNodes.length === 0) {
     return <div className="text-center text-muted-foreground p-4 h-[400px] flex items-center justify-center">No transactions found to build a graph.</div>;
   }
    if (analysisPerformed && (!scheduleInput || !scheduleInput.trim())) {
     return <div className="text-center text-muted-foreground p-4 h-[400px] flex items-center justify-center">Schedule is empty.</div>;
   }
   if (nodes.length === 0 && initialNodes.length > 0) { 
     return <div className="text-center text-muted-foreground p-4 h-[400px] flex items-center justify-center">Initializing graph...</div>;
   }
   // Default placeholder if no specific condition met yet (e.g., initial state before any analysis attempt)
   if (!analysisPerformed && (!scheduleInput || !scheduleInput.trim())) {
      return <div className="text-center text-muted-foreground p-4 h-[400px] flex items-center justify-center">Enter a schedule and run analyzer.</div>;
   }


  return (
    <svg 
      id={svgId} 
      ref={svgRef}
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className="border rounded-md bg-card text-foreground shadow-sm overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleSvgMouseDown}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id={`arrowhead-default-${svgId}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon id={`arrowhead-default-polygon-${svgId}`} points="0 0, 10 3.5, 0 7" style={{ fill: 'hsl(var(--foreground))' }} />
        </marker>
        <marker id={`arrowhead-rw-${svgId}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon id={`arrowhead-rw-polygon-${svgId}`} points="0 0, 10 3.5, 0 7" style={{ fill: 'hsl(var(--chart-2))' }} />
        </marker>
        <marker id={`arrowhead-wr-${svgId}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon id={`arrowhead-wr-polygon-${svgId}`} points="0 0, 10 3.5, 0 7" style={{ fill: 'hsl(var(--chart-4))' }} />
        </marker>
        <marker id={`arrowhead-ww-${svgId}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon id={`arrowhead-ww-polygon-${svgId}`} points="0 0, 10 3.5, 0 7" style={{ fill: 'hsl(var(--chart-5))' }} />
        </marker>
        <marker id={`arrowhead-cycle-${svgId}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon id={`arrowhead-cycle-polygon-${svgId}`} points="0 0, 10 3.5, 0 7" style={{ fill: 'hsl(var(--destructive))' }} />
        </marker>
      </defs>
      <g transform={`translate(${panOffset.x} ${panOffset.y}) scale(${currentScale})`}>
        {edges.map((edge, index) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const nodeRadius = 20; // Visual radius, not scaled here for offset calculation
          const arrowOffset = 5; // Additional offset for arrowhead
          const effectiveOffset = nodeRadius + arrowOffset;


          const endX = dist === 0 ? targetNode.x : targetNode.x - (dx / dist) * effectiveOffset;
          const endY = dist === 0 ? targetNode.y : targetNode.y - (dy / dist) * effectiveOffset;
          
          const textX = (sourceNode.x + targetNode.x) / 2;
          const textY = (sourceNode.y + targetNode.y) / 2 - (8 / currentScale) ; // Adjusted offset

          const edgeStyle = getEdgeColorStyle(edge);
          const arrowId = getArrowMarkerId(edge);
          
          return (
            <g key={`${edge.source}-${edge.target}-${index}-${edge.label}-${edge.isCycleEdge}`} id={`edge-group-${index}`}>
              <line
                id={`edge-line-${index}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={endX}
                y2={endY}
                style={edgeStyle}
                strokeWidth={2 / currentScale}
                markerEnd={arrowId}
                className={edge.isCycleEdge ? 'animate-pulse' : ''}
              />
              <text
                id={`edge-text-${index}`}
                x={textX}
                y={textY}
                fontSize={10 / currentScale}
                style={edgeStyle} 
                textAnchor="middle"
                dominantBaseline="central"
                className="font-mono select-none"
              >
                {edge.label}
              </text>
            </g>
          );
        })}
        {nodes.map(node => (
          <g key={node.id} 
             onMouseDown={(e) => handleNodeMouseDown(e, node.id)} 
             className="cursor-pointer group"
             id={`node-group-${node.id}`}
          >
            <circle
              id={`node-circle-${node.id}`}
              cx={node.x}
              cy={node.y}
              r="20"
              style={{
                fill: 'hsl(var(--primary))',
                stroke: 'hsl(var(--primary-foreground))',
                // strokeWidth will be set by getSvgWithResolvedColorsNode during export
              }}
              strokeWidth={1.5 / currentScale} // Dynamic for live view
              className="group-hover:opacity-80 transition-opacity"
            />
            <text
              id={`node-text-${node.id}`}
              x={node.x}
              y={node.y}
              dy=".1em" 
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12 / currentScale}
              fontWeight="bold"
              style={{ fill: 'hsl(var(--primary-foreground))' }}
              className="select-none"
            >
              {node.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
