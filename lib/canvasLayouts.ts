/**
 * Canvas Auto-Layout Algorithms
 * 
 * Implements various layout algorithms for smart node arrangement:
 * - Tree Layout: Hierarchical top-down arrangement
 * - Force-Directed Layout: Physics-based node positioning
 * - Grid Layout: Organized grid arrangement
 * - Circular Layout: Nodes arranged in a circle
 */

import { Node, Edge } from 'reactflow';

export type LayoutType = 'tree' | 'force' | 'grid' | 'circular' | 'hierarchical';

interface LayoutOptions {
  nodeSpacing?: number;
  levelSpacing?: number;
  iterations?: number;
}

/**
 * Tree Layout: Hierarchical arrangement from top to bottom
 * Ideal for: Mind maps, org charts, decision trees
 */
export function applyTreeLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { nodeSpacing = 250, levelSpacing = 150 } = options;

  // Build adjacency list
  const children = new Map<string, string[]>();
  const parents = new Map<string, string>();
  
  edges.forEach(edge => {
    if (!children.has(edge.source)) {
      children.set(edge.source, []);
    }
    children.get(edge.source)!.push(edge.target);
    parents.set(edge.target, edge.source);
  });

  // Find root nodes (nodes with no parents)
  const roots = nodes.filter(node => !parents.has(node.id));
  if (roots.length === 0 && nodes.length > 0) {
    // If no root found, use first node
    roots.push(nodes[0]);
  }

  const positioned = new Set<string>();

  const positionSubtree = (nodeId: string, level: number, xOffset: number): number => {
    if (positioned.has(nodeId)) return xOffset;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return xOffset;

    const nodeChildren = children.get(nodeId) || [];
    let currentX = xOffset;

    if (nodeChildren.length === 0) {
      // Leaf node
      node.position = { x: currentX, y: level * levelSpacing };
      positioned.add(nodeId);
      return currentX + nodeSpacing;
    }

    // Position children first
    const childPositions: number[] = [];
    nodeChildren.forEach(childId => {
      childPositions.push(currentX);
      currentX = positionSubtree(childId, level + 1, currentX);
    });

    // Center parent over children
    const childStart = childPositions[0];
    const childEnd = currentX - nodeSpacing;
    const centerX = (childStart + childEnd) / 2;

    node.position = { x: centerX, y: level * levelSpacing };
    positioned.add(nodeId);

    return currentX;
  };

  // Position each root tree
  let globalX = 0;
  roots.forEach(root => {
    globalX = positionSubtree(root.id, 0, globalX);
  });

  // Position any remaining unconnected nodes
  nodes.forEach(node => {
    if (!positioned.has(node.id)) {
      node.position = { x: globalX, y: 0 };
      globalX += nodeSpacing;
    }
  });

  return nodes;
}

/**
 * Force-Directed Layout: Physics simulation for organic arrangement
 * Ideal for: Network graphs, relationship maps, clusters
 */
export function applyForceLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { iterations = 100, nodeSpacing: _nodeSpacing = 200 } = options;
  
  // Initialize random positions if not set
  nodes.forEach((node) => {
    if (!node.position || (node.position.x === 0 && node.position.y === 0)) {
      node.position = {
        x: Math.random() * 800,
        y: Math.random() * 600,
      };
    }
  });

  const repulsion = 10000; // Strength of node repulsion
  const attraction = 0.01; // Strength of edge attraction
  const damping = 0.85; // Velocity damping

  // Velocity tracking
  const velocities = nodes.map(() => ({ x: 0, y: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    const forces = nodes.map(() => ({ x: 0, y: 0 }));

    // Repulsion: All nodes repel each other
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].position.x - nodes[i].position.x;
        const dy = nodes[j].position.y - nodes[i].position.y;
        const distSq = dx * dx + dy * dy + 1; // Avoid division by zero
        const dist = Math.sqrt(distSq);
        
        const force = repulsion / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }
    }

    // Attraction: Connected nodes attract each other
    edges.forEach(edge => {
      const sourceIdx = nodes.findIndex(n => n.id === edge.source);
      const targetIdx = nodes.findIndex(n => n.id === edge.target);
      
      if (sourceIdx === -1 || targetIdx === -1) return;

      const dx = nodes[targetIdx].position.x - nodes[sourceIdx].position.x;
      const dy = nodes[targetIdx].position.y - nodes[sourceIdx].position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const force = attraction * dist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      forces[sourceIdx].x += fx;
      forces[sourceIdx].y += fy;
      forces[targetIdx].x -= fx;
      forces[targetIdx].y -= fy;
    });

    // Apply forces with damping
    nodes.forEach((node, i) => {
      velocities[i].x = (velocities[i].x + forces[i].x) * damping;
      velocities[i].y = (velocities[i].y + forces[i].y) * damping;

      node.position.x += velocities[i].x;
      node.position.y += velocities[i].y;
    });

    // Cooling: Reduce force over time
    const cooling = 1 - (iter / iterations);
    velocities.forEach(v => {
      v.x *= cooling;
      v.y *= cooling;
    });
  }

  // Center the graph
  const minX = Math.min(...nodes.map(n => n.position.x));
  const minY = Math.min(...nodes.map(n => n.position.y));
  nodes.forEach(node => {
    node.position.x -= minX - 50;
    node.position.y -= minY - 50;
  });

  return nodes;
}

/**
 * Grid Layout: Organize nodes in a neat grid
 * Ideal for: Collections, galleries, uniform arrangements
 */
export function applyGridLayout(
  nodes: Node[],
  _edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { nodeSpacing = 200 } = options;
  
  const cols = Math.ceil(Math.sqrt(nodes.length));
  
  nodes.forEach((node, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    node.position = {
      x: col * nodeSpacing,
      y: row * nodeSpacing,
    };
  });

  return nodes;
}

/**
 * Circular Layout: Arrange nodes in a circle
 * Ideal for: Cycles, loops, equal relationships
 */
export function applyCircularLayout(
  nodes: Node[],
  _edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { nodeSpacing = 300 } = options;
  const radius = (nodes.length * nodeSpacing) / (2 * Math.PI);
  const centerX = radius + 100;
  const centerY = radius + 100;

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    node.position = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return nodes;
}

/**
 * Hierarchical Layout: Layered arrangement with rank assignment
 * Ideal for: Dependency graphs, flowcharts, process diagrams
 */
export function applyHierarchicalLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const { nodeSpacing = 250, levelSpacing = 150 } = options;

  // Build adjacency lists
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  
  nodes.forEach(node => {
    outgoing.set(node.id, []);
    incoming.set(node.id, 0);
  });

  edges.forEach(edge => {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
  });

  // Topological sort to assign levels
  const levels: string[][] = [];
  const level = new Map<string, number>();
  const queue: string[] = [];

  // Start with nodes that have no incoming edges
  incoming.forEach((count, nodeId) => {
    if (count === 0) {
      queue.push(nodeId);
      level.set(nodeId, 0);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = level.get(current)!;

    if (!levels[currentLevel]) {
      levels[currentLevel] = [];
    }
    levels[currentLevel].push(current);

    outgoing.get(current)?.forEach(neighbor => {
      const newCount = (incoming.get(neighbor) || 0) - 1;
      incoming.set(neighbor, newCount);

      if (newCount === 0) {
        queue.push(neighbor);
        level.set(neighbor, currentLevel + 1);
      }
    });
  }

  // Handle cycles: assign remaining nodes to level 0
  nodes.forEach(node => {
    if (!level.has(node.id)) {
      if (!levels[0]) levels[0] = [];
      levels[0].push(node.id);
      level.set(node.id, 0);
    }
  });

  // Position nodes
  levels.forEach((levelNodes, lvl) => {
    const totalWidth = levelNodes.length * nodeSpacing;
    const startX = -totalWidth / 2 + nodeSpacing / 2;

    levelNodes.forEach((nodeId, idx) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        node.position = {
          x: startX + idx * nodeSpacing + 400, // Center offset
          y: lvl * levelSpacing,
        };
      }
    });
  });

  return nodes;
}

/**
 * Apply the specified layout algorithm
 */
export function applyLayout(
  layoutType: LayoutType,
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions
): Node[] {
  switch (layoutType) {
    case 'tree':
      return applyTreeLayout(nodes, edges, options);
    case 'force':
      return applyForceLayout(nodes, edges, options);
    case 'grid':
      return applyGridLayout(nodes, edges, options);
    case 'circular':
      return applyCircularLayout(nodes, edges, options);
    case 'hierarchical':
      return applyHierarchicalLayout(nodes, edges, options);
    default:
      return nodes;
  }
}
