/**
 * Shared utilities for Memory Graph components
 */

import { getCurrentLocale, intlLocaleTag } from '@/i18n';
import type { MemoryNode, MemoryEdge, Position2D, LayoutResult } from './types';

// Entity type colors (matching Zep's schema + inferred types)
export const typeColors: Record<string, number> = {
  // Core types
  user: 0x00d9a6, // Teal/green - central user node
  assistant: 0x7c4dff, // Purple - AI assistant

  // People & Pets
  person: 0xff6b9d, // Pink - people
  pet: 0xffab91, // Coral/peach - pets and animals

  // Places
  location: 0x26c6da, // Cyan - geographic locations (cities, countries)
  place: 0x4dd0e1, // Light cyan - specific places (home, park, office)

  // Preferences & Interests
  preference: 0xffb74d, // Amber - user preferences
  topic: 0x7e57c2, // Deep purple - topics/subjects of interest

  // Work & Skills
  skill: 0x81c784, // Light green - skills/expertise/profession
  project: 0xffca28, // Yellow - projects
  organization: 0xffa726, // Orange - companies, institutions
  product: 0x4fc3f7, // Light blue - products/services

  // Events & Activities
  event: 0x5c6bc0, // Indigo - events, meetings
  activity: 0xec407a, // Pink - activities

  // Goals & Procedures
  goal: 0xef5350, // Red - goals/objectives
  procedure: 0x4db6ac, // Teal - procedures/instructions

  // Properties
  attribute: 0x29b6f6, // Sky blue - attributes/properties (colors, ages)

  // Media & Arts
  genre: 0xab47bc, // Purple - genres/categories
  artist: 0xce93d8, // Light purple - artists/creators

  // Other
  fact: 0x90a4ae, // Blue-grey - facts
  tool: 0x66bb6a, // Green - tools
  venue: 0x80deea, // Aqua - venues

  // Default fallback
  entity: 0xb0bec5, // Light blue-grey (default - neutral)
};

export const typeColorsHex: Record<string, string> = {
  // Core types
  user: '#00d9a6',
  assistant: '#7c4dff',

  // People & Pets
  person: '#ff6b9d',
  pet: '#ffab91',

  // Places
  location: '#26c6da',
  place: '#4dd0e1',

  // Preferences & Interests
  preference: '#ffb74d',
  topic: '#7e57c2',

  // Work & Skills
  skill: '#81c784',
  project: '#ffca28',
  organization: '#ffa726',
  product: '#4fc3f7',

  // Events & Activities
  event: '#5c6bc0',
  activity: '#ec407a',

  // Goals & Procedures
  goal: '#ef5350',
  procedure: '#4db6ac',

  // Properties
  attribute: '#29b6f6',

  // Media & Arts
  genre: '#ab47bc',
  artist: '#ce93d8',

  // Other
  fact: '#90a4ae',
  tool: '#66bb6a',
  venue: '#80deea',

  // Default fallback
  entity: '#b0bec5',
};

export const defaultColor = 0xb0bec5;
export const defaultColorHex = '#b0bec5';

export function getNodeColor(type: string): number {
  const key = type.toLowerCase() as keyof typeof typeColors;
  return typeColors[key] ?? defaultColor;
}

export function getNodeColorHex(type: string): string {
  const key = type.toLowerCase() as keyof typeof typeColorsHex;
  return typeColorsHex[key] ?? defaultColorHex;
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const tag = intlLocaleTag(getCurrentLocale());
    return date.toLocaleDateString(tag, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: tag.startsWith('en'),
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculate node degrees (connection counts)
 */
export function calculateDegrees(nodes: MemoryNode[], edges: MemoryEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();

  nodes.forEach((node) => {
    degrees.set(node.id, 0);
  });

  edges.forEach((edge) => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  });

  return degrees;
}

/**
 * Find the central node (highest degree)
 */
export function findCentralNode(degrees: Map<string, number>): string {
  let centralNodeId = 'user';
  let maxDegree = 0;

  degrees.forEach((degree, id) => {
    if (degree > maxDegree) {
      maxDegree = degree;
      centralNodeId = id;
    }
  });

  return centralNodeId;
}

/**
 * Calculate node radius based on degree
 */
export function calculateNodeRadius(
  degree: number,
  maxDegree: number,
  isUser: boolean,
  minRadius = 6,
  maxRadius = 16,
): number {
  const degreeScale = Math.min(degree / maxDegree, 1);
  let radius = minRadius + (maxRadius - minRadius) * Math.sqrt(degreeScale);
  if (isUser) radius = Math.max(radius, 14);
  return radius;
}

/**
 * 2D Force-directed layout algorithm — scales with graph density
 */
export function calculate2DLayout(
  nodes: MemoryNode[],
  edges: MemoryEdge[],
  width: number,
  height: number,
  iterations = 300,
): LayoutResult {
  const positions = new Map<string, Position2D>();
  const degrees = calculateDegrees(nodes, edges);
  const centralNodeId = findCentralNode(degrees);

  // Gentle scale factor for larger graphs
  const n = nodes.length;
  const scale = n <= 20 ? 1 : 1 + Math.log10(n / 15) * 0.65;

  // Find nodes connected to central node
  const connectedToCentral = new Set<string>();
  edges.forEach((edge) => {
    if (edge.source === centralNodeId) connectedToCentral.add(edge.target);
    if (edge.target === centralNodeId) connectedToCentral.add(edge.source);
  });

  // Initial positions: radial layout — scale radii with density
  const centerX = width / 2;
  const centerY = height / 2;
  const baseSize = Math.min(width, height);
  const directRadius = baseSize * 0.12 * scale;
  const indirectRadius = baseSize * 0.22 * scale;

  let directAngle = 0;
  let indirectAngle = 0;
  const directAngleStep = (2 * Math.PI) / Math.max(connectedToCentral.size, 1);
  const indirectNodes = nodes.filter(
    (n) => n.id !== centralNodeId && !connectedToCentral.has(n.id),
  );
  const indirectAngleStep = (2 * Math.PI) / Math.max(indirectNodes.length, 1);

  nodes.forEach((node) => {
    if (node.id === centralNodeId) {
      positions.set(node.id, { x: centerX, y: centerY });
    } else if (connectedToCentral.has(node.id)) {
      positions.set(node.id, {
        x: centerX + directRadius * Math.cos(directAngle),
        y: centerY + directRadius * Math.sin(directAngle),
      });
      directAngle += directAngleStep;
    } else {
      positions.set(node.id, {
        x: centerX + indirectRadius * Math.cos(indirectAngle + Math.PI / 4),
        y: centerY + indirectRadius * Math.sin(indirectAngle + Math.PI / 4),
      });
      indirectAngle += indirectAngleStep;
    }
  });

  // Force-directed refinement — scale params with graph size
  const totalIterations = Math.min(iterations + n * 2, 600);
  const k = 0.15;
  const baseRepulsion = 8000 * scale;
  const minDistance = 30 + 15 * scale;

  for (let i = 0; i < totalIterations; i++) {
    const cooling = 1 - (i / totalIterations) * 0.7;

    // Repulsion
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const nodeA = nodes[a];
        const nodeB = nodes[b];
        if (!nodeA || !nodeB) continue;

        const posA = positions.get(nodeA.id)!;
        const posB = positions.get(nodeB.id)!;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const degreeA = degrees.get(nodeA.id) || 1;
        const degreeB = degrees.get(nodeB.id) || 1;
        const degreeFactor = Math.sqrt(degreeA * degreeB) / 2 + 1;

        const repulsion = baseRepulsion * degreeFactor;
        let force = (repulsion / (dist * dist)) * cooling;

        if (dist < minDistance) {
          force += (minDistance - dist) * 2 * cooling;
        }

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (nodeA.id !== centralNodeId) {
          posA.x += fx;
          posA.y += fy;
        }
        if (nodeB.id !== centralNodeId) {
          posB.x -= fx;
          posB.y -= fy;
        }
      }
    }

    // Attraction along edges
    edges.forEach((edge) => {
      const posA = positions.get(edge.source);
      const posB = positions.get(edge.target);

      if (posA && posB) {
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const degreeA = degrees.get(edge.source) || 1;
        const degreeB = degrees.get(edge.target) || 1;
        const targetLength = 30 * scale + Math.max(degreeA, degreeB) * 4;

        const force = (dist - targetLength) * k * cooling;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (edge.source !== centralNodeId) {
          posA.x += fx;
          posA.y += fy;
        }
        if (edge.target !== centralNodeId) {
          posB.x -= fx;
          posB.y -= fy;
        }
      }
    });

    // Boundary constraints — expand for dense graphs
    const padding = 50;
    const boundsW = width * scale;
    const boundsH = height * scale;
    const offsetX = (width - boundsW) / 2;
    const offsetY = (height - boundsH) / 2;
    positions.forEach((pos, id) => {
      if (id !== centralNodeId) {
        pos.x = Math.max(offsetX + padding, Math.min(offsetX + boundsW - padding, pos.x));
        pos.y = Math.max(offsetY + padding, Math.min(offsetY + boundsH - padding, pos.y));
      }
    });
  }

  return { positions, degrees };
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 2) + '..';
}
