import type { Operation, Conflict, GraphNode, GraphEdge } from '@/types/transaction-analyzer';

export const detectConflicts = (operations: Operation[]): Conflict[] => {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < operations.length; i++) {
    for (let j = 0; j < operations.length; j++) { // Iterate all operations to check, not just j > i
      if (i === j) continue;

      const op1 = operations[i];
      const op2 = operations[j];

      // Conflict conditions:
      // 1. Different transactions
      // 2. Access the same variable
      // 3. At least one is a write operation
      // 4. op1 occurs before op2 in the original schedule
      if (op1.transactionId !== op2.transactionId &&
          op1.variable && op1.variable === op2.variable &&
          (op1.type === 'W' || op2.type === 'W') &&
          op1.step < op2.step) { // Ensure op1 precedes op2
        
        let conflictType: 'RW' | 'WR' | 'WW' | null = null;
        if (op1.type === 'R' && op2.type === 'W') conflictType = 'RW';
        else if (op1.type === 'W' && op2.type === 'R') conflictType = 'WR';
        else if (op1.type === 'W' && op2.type === 'W') conflictType = 'WW';

        if (conflictType) {
          conflicts.push({ op1, op2, type: conflictType, variable: op1.variable });
        }
      }
    }
  }
  return conflicts;
};

export const buildPrecedenceGraph = (
  transactionIds: string[],
  conflicts: Conflict[]
): { nodes: GraphNode[]; edges: GraphEdge[]; isSerializable: boolean; cycleEdges: GraphEdge[] } => {
  const nodes: GraphNode[] = transactionIds.map((id, index) => {
    const angle = (index / transactionIds.length) * 2 * Math.PI;
    // A simple circular layout for nodes
    return {
      id,
      label: id,
      x: 200 + 150 * Math.cos(angle), // Arbitrary center and radius
      y: 200 + 150 * Math.sin(angle),
    };
  });

  const edges: GraphEdge[] = conflicts.map(conflict => ({
    source: conflict.op1.transactionId,
    target: conflict.op2.transactionId,
    label: `${conflict.type}(${conflict.variable})`,
  }));

  // Deduplicate edges (e.g. T1 -> T2 might arise from multiple conflicts)
  const uniqueEdgesMap = new Map<string, GraphEdge>();
  edges.forEach(edge => {
    const key = `${edge.source}->${edge.target}`;
    if (!uniqueEdgesMap.has(key)) {
      uniqueEdgesMap.set(key, edge);
    } else {
      // Optionally append labels if multiple conflict types for the same edge
      uniqueEdgesMap.get(key)!.label += `, ${edge.label}`;
    }
  });
  const uniqueEdges = Array.from(uniqueEdgesMap.values());
  
  const { hasCycle, cyclePath } = detectCycle(transactionIds, uniqueEdges);

  const cycleEdgeKeys = new Set<string>();
  if (hasCycle) {
    for (let i = 0; i < cyclePath.length -1; i++) {
      cycleEdgeKeys.add(`${cyclePath[i]}->${cyclePath[i+1]}`);
    }
     // Last edge connecting back to the start of the cycle
    cycleEdgeKeys.add(`${cyclePath[cyclePath.length - 1]}->${cyclePath[0]}`);
  }
  
  const finalEdges = uniqueEdges.map(edge => ({
    ...edge,
    isCycleEdge: cycleEdgeKeys.has(`${edge.source}->${edge.target}`)
  }));
  
  const cycleActualEdges = finalEdges.filter(e => e.isCycleEdge);

  return { nodes, edges: finalEdges, isSerializable: !hasCycle, cycleEdges: cycleActualEdges };
};


// Helper for cycle detection (DFS-based)
const detectCycle = (
  nodes: string[],
  edges: GraphEdge[]
): { hasCycle: boolean; cyclePath: string[] } => {
  const adj = new Map<string, string[]>();
  nodes.forEach(node => adj.set(node, []));
  edges.forEach(edge => adj.get(edge.source)?.push(edge.target));

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  for (const node of nodes) {
    if (!visited.has(node)) {
      if (dfs(node, visited, recursionStack, adj, path)) {
        // Reconstruct cycle path (simplified)
        const cycleStartNode = path[path.length-1]; // Last node added is where cycle was detected
        let cycleStartIndex = -1;
        for(let i=0; i < path.length -1; i++) {
          if(path[i] === cycleStartNode) {
            cycleStartIndex = i;
            break;
          }
        }
        if(cycleStartIndex !== -1) {
           return { hasCycle: true, cyclePath: path.slice(cycleStartIndex, path.length-1) };
        }
        return { hasCycle: true, cyclePath: [cycleStartNode] }; // Fallback if full path reconstruction is hard
      }
    }
  }
  return { hasCycle: false, cyclePath: [] };
};

const dfs = (
  node: string,
  visited: Set<string>,
  recursionStack: Set<string>,
  adj: Map<string, string[]>,
  path: string[]
): boolean => {
  visited.add(node);
  recursionStack.add(node);
  path.push(node);

  const neighbors = adj.get(node) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      if (dfs(neighbor, visited, recursionStack, adj, path)) return true;
    } else if (recursionStack.has(neighbor)) {
      path.push(neighbor); // Add the node that closes the cycle
      return true; // Cycle detected
    }
  }

  recursionStack.delete(node);
  // Do not pop from path here if we want to reconstruct it later from the main detectCycle function
  // path.pop(); // Backtrack
  return false;
};
