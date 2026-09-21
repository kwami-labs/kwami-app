/**
 * Shared types for Memory Graph components
 */

import type {
  MemoryNode,
  MemoryEdge,
  MemoryGraph,
  UpdateNodePayload,
  UpdateEdgePayload,
} from 'kwami';

export type { MemoryNode, MemoryEdge, MemoryGraph, UpdateNodePayload, UpdateEdgePayload };

export type ViewMode = '3d' | '2d';

export interface Position2D {
  x: number;
  y: number;
}

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface NodeWithPosition extends MemoryNode {
  position: Position2D;
  radius: number;
  degree: number;
}

export interface LayoutResult {
  positions: Map<string, Position2D>;
  degrees: Map<string, number>;
}

export interface GraphProps {
  graph: MemoryGraph;
  showEdgeLabels: boolean;
  selectedNodeId: string | null;
}

export interface GraphEmits {
  (e: 'select-node', node: MemoryNode | null): void;
}
