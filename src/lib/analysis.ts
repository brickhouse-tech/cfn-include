/**
 * Dependency Graph Analysis (Phase 4.2 of #90)
 *
 * Provides:
 * - Connection strength analysis between resources
 * - Cluster quality scoring (cohesion vs coupling)
 * - Strongly-connected component detection (Tarjan's algorithm)
 *
 * Used by clustering.ts to make smart grouping decisions.
 */

import type { DependencyGraph, DependencyEdge } from './graph.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Connectivity strength between two resources.
 * Higher score = more reasons to keep together.
 */
export interface ConnectionStrength {
  source: string;
  target: string;
  /** Number of different dependency edges (Ref + GetAtt + DependsOn) */
  edgeCount: number;
  /** Bidirectional dependencies are stronger */
  isBidirectional: boolean;
  /** Shared condition usage */
  sharedConditions: string[];
  /** Overall strength score (0-100) */
  score: number;
}

/**
 * Metrics for evaluating cluster quality.
 */
export interface ClusterScore {
  clusterId: string;
  /** Intra-cluster connections (higher is better) */
  cohesion: number;
  /** Cross-cluster connections (lower is better) */
  coupling: number;
  /** Resource count and % of limit */
  size: number;
  sizePercent: number;
  /** Overall quality score (cohesion - coupling, normalized) */
  quality: number;
}

/**
 * A strongly-connected component in the graph.
 */
export interface StrongComponent {
  resourceIds: string[];
  /** True if component forms a dependency cycle */
  isCyclic: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** CloudFormation resource limit per stack. */
const CFN_RESOURCE_LIMIT = 500;

// ── Connection Strength Analysis ─────────────────────────────────────────────

/**
 * Compute connection strength between all resource pairs.
 */
export function analyzeConnectivity(graph: DependencyGraph): Map<string, ConnectionStrength> {
  const strengths = new Map<string, ConnectionStrength>();

  // Build strength map from edges
  for (const edge of graph.edges) {
    const key = `${edge.source}:${edge.target}`;
    let strength = strengths.get(key);

    if (!strength) {
      strength = {
        source: edge.source,
        target: edge.target,
        edgeCount: 0,
        isBidirectional: false,
        sharedConditions: [],
        score: 0,
      };
      strengths.set(key, strength);
    }

    strength.edgeCount++;
  }

  // Check bidirectionality
  for (const [key, strength] of strengths) {
    const reverseKey = `${strength.target}:${strength.source}`;
    if (strengths.has(reverseKey)) {
      strength.isBidirectional = true;
      strengths.get(reverseKey)!.isBidirectional = true;
    }
  }

  // Check shared conditions
  for (const [condName, resourceSet] of graph.conditionUsage) {
    const resources = Array.from(resourceSet);
    for (let i = 0; i < resources.length; i++) {
      for (let j = i + 1; j < resources.length; j++) {
        const key1 = `${resources[i]}:${resources[j]}`;
        const key2 = `${resources[j]}:${resources[i]}`;
        const strength1 = strengths.get(key1);
        const strength2 = strengths.get(key2);
        if (strength1) strength1.sharedConditions.push(condName);
        if (strength2) strength2.sharedConditions.push(condName);
      }
    }
  }

  // Calculate scores
  for (const strength of strengths.values()) {
    let score = strength.edgeCount * 20; // Base: 20 points per edge
    if (strength.isBidirectional) score += 30; // Bidirectional bonus
    score += strength.sharedConditions.length * 15; // Condition bonus
    strength.score = Math.min(100, score);
  }

  return strengths;
}

// ── Cluster Quality Scoring ──────────────────────────────────────────────────

/**
 * Score a cluster's quality based on internal/external dependencies.
 */
export function scoreCluster(
  clusterId: string,
  resourceIds: string[],
  graph: DependencyGraph,
  allClusters: Map<string, string[]>,
): ClusterScore {
  const resourceSet = new Set(resourceIds);
  const resourceToCluster = new Map<string, string>();

  for (const [cId, rIds] of allClusters) {
    for (const rId of rIds) {
      resourceToCluster.set(rId, cId);
    }
  }

  let internalEdges = 0;
  let externalEdges = 0;

  for (const edge of graph.edges) {
    const sourceCluster = resourceToCluster.get(edge.source);
    const targetCluster = resourceToCluster.get(edge.target);

    if (sourceCluster === clusterId && targetCluster === clusterId) {
      internalEdges++;
    } else if (sourceCluster === clusterId || targetCluster === clusterId) {
      externalEdges++;
    }
  }

  // Cohesion: normalize by average graph density (not theoretical max)
  // Typical CFN templates have ~2-4 deps per resource, not full mesh
  const avgDepsPerResource = graph.edges.length / Math.max(1, graph.resourceIds.size);
  const expectedInternalEdges = resourceIds.length * avgDepsPerResource * 0.7; // 70% internal is realistic
  const cohesion =
    resourceIds.length > 1 && expectedInternalEdges > 0
      ? Math.min(1, internalEdges / expectedInternalEdges)
      : 0;

  const coupling = externalEdges / Math.max(1, resourceIds.length);
  const size = resourceIds.length;
  const sizePercent = (size / CFN_RESOURCE_LIMIT) * 100;

  // Quality = cohesion (0-1) minus coupling penalty
  const quality = Math.max(0, cohesion - coupling * 0.5);

  return { clusterId, cohesion, coupling, size, sizePercent, quality };
}

// ── Strongly-Connected Components (Tarjan's Algorithm) ───────────────────────

/**
 * Find strongly-connected components (Tarjan's algorithm).
 * Resources in cyclic components must stay in same stack.
 */
export function detectStronglyConnectedComponents(
  graph: DependencyGraph,
): StrongComponent[] {
  const resourceIds = Array.from(graph.resourceIds);
  const indexMap = new Map<string, number>();
  const lowLinkMap = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: StrongComponent[] = [];
  let index = 0;

  function strongConnect(v: string) {
    indexMap.set(v, index);
    lowLinkMap.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const node = graph.nodes.get(v);
    if (node) {
      for (const w of node.dependsOn) {
        if (!indexMap.has(w)) {
          strongConnect(w);
          lowLinkMap.set(v, Math.min(lowLinkMap.get(v)!, lowLinkMap.get(w)!));
        } else if (onStack.has(w)) {
          lowLinkMap.set(v, Math.min(lowLinkMap.get(v)!, indexMap.get(w)!));
        }
      }
    }

    // If v is a root node, pop the stack and create an SCC
    if (lowLinkMap.get(v) === indexMap.get(v)) {
      const component: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        component.push(w);
      } while (w !== v);

      // A component is cyclic if it has more than 1 resource
      const isCyclic = component.length > 1;
      components.push({ resourceIds: component.sort(), isCyclic });
    }
  }

  for (const v of resourceIds) {
    if (!indexMap.has(v)) {
      strongConnect(v);
    }
  }

  return components;
}
