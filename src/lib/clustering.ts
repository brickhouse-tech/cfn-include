/**
 * Smart Resource Clustering (Phase 4.2 of #90)
 *
 * Provides:
 * - Hybrid clustering algorithm (connectivity + semantic)
 * - Cluster optimization via resource moves
 * - Size constraint enforcement
 *
 * Uses analysis from analysis.ts to make intelligent grouping decisions.
 */

import type { TemplateDocument } from '../types/template.js';
import type { DependencyGraph } from './graph.js';
import {
  analyzeConnectivity,
  detectStronglyConnectedComponents,
  scoreCluster,
  type ConnectionStrength,
  type ClusterScore,
  type StrongComponent,
} from './analysis.js';
import { categorizeResource } from './split.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Options for clustering algorithm.
 */
export interface ClusteringOptions {
  /** Maximum resources per cluster (default: 400, 80% of limit) */
  maxClusterSize?: number;
  /** Minimum cluster quality score to accept (0-1, default: 0.3) */
  minQuality?: number;
  /** Strategy: 'connectivity' | 'semantic' | 'hybrid' */
  strategy?: 'connectivity' | 'semantic' | 'hybrid';
}

/**
 * A resource cluster with metadata.
 */
export interface ResourceCluster {
  id: string;
  name: string;
  category: string;
  resourceIds: string[];
  resourceTypes: Record<string, number>;
  score: ClusterScore;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_CLUSTER_SIZE = 400;
const DEFAULT_MIN_QUALITY = 0.3;
const MAX_OPTIMIZATION_ITERATIONS = 10;
const MIN_IMPROVEMENT_THRESHOLD = 0.05;

// ── Main Clustering Algorithm ────────────────────────────────────────────────

/**
 * Cluster resources using dependency analysis + semantic grouping.
 * Returns optimized clusters ready for stack splitting.
 */
export function clusterResources(
  template: TemplateDocument,
  graph: DependencyGraph,
  options?: ClusteringOptions,
): ResourceCluster[] {
  const opts: Required<ClusteringOptions> = {
    maxClusterSize: options?.maxClusterSize ?? DEFAULT_MAX_CLUSTER_SIZE,
    minQuality: options?.minQuality ?? DEFAULT_MIN_QUALITY,
    strategy: options?.strategy ?? 'hybrid',
  };

  // Step 1: Find strongly-connected components (must stay together)
  const sccs = detectStronglyConnectedComponents(graph);

  // Step 2: Initial semantic grouping
  const initialClusters = semanticGrouping(template);

  // Step 3: Analyze connectivity
  const connectivity = analyzeConnectivity(graph);

  // Step 4: Apply strategy-specific clustering
  let clusters: ResourceCluster[];
  if (opts.strategy === 'semantic') {
    clusters = initialClusters;
  } else if (opts.strategy === 'connectivity') {
    clusters = connectivityBasedClustering(template, graph, connectivity, sccs);
  } else {
    // Hybrid: start with semantic, then merge by connectivity
    clusters = mergeByConnectivity(initialClusters, connectivity, sccs, graph);
  }

  // Step 5: Optimize cluster boundaries
  clusters = optimizeClusters(clusters, graph, connectivity);

  // Step 6: Enforce size constraints
  clusters = enforceConstraints(clusters, graph, opts.maxClusterSize);

  // Step 7: Score all clusters
  const clusterMap = new Map(clusters.map((c) => [c.id, c.resourceIds]));
  for (const cluster of clusters) {
    cluster.score = scoreCluster(cluster.id, cluster.resourceIds, graph, clusterMap);
  }

  return clusters;
}

// ── Semantic Grouping ────────────────────────────────────────────────────────

/**
 * Initial grouping by resource type category (existing approach from split.ts).
 */
function semanticGrouping(template: TemplateDocument): ResourceCluster[] {
  const resources = template.Resources ?? {};
  const categoryMap = new Map<string, string[]>();

  for (const [logicalId, resource] of Object.entries(resources)) {
    const cat = categorizeResource(resource.Type ?? 'Unknown');
    let arr = categoryMap.get(cat);
    if (!arr) {
      arr = [];
      categoryMap.set(cat, arr);
    }
    arr.push(logicalId);
  }

  const clusters: ResourceCluster[] = [];
  let clusterId = 0;

  for (const [category, ids] of categoryMap) {
    const types: Record<string, number> = {};
    for (const id of ids) {
      const t = resources[id]?.Type ?? 'Unknown';
      types[t] = (types[t] ?? 0) + 1;
    }
    clusters.push({
      id: `cluster-${clusterId++}`,
      name: category,
      category,
      resourceIds: ids.sort(),
      resourceTypes: types,
      score: {
        clusterId: '',
        cohesion: 0,
        coupling: 0,
        size: ids.length,
        sizePercent: 0,
        quality: 0,
      },
    });
  }

  return clusters;
}

// ── Connectivity-Based Clustering ────────────────────────────────────────────

/**
 * Pure connectivity-based clustering (ignores semantic categories).
 */
function connectivityBasedClustering(
  template: TemplateDocument,
  graph: DependencyGraph,
  connectivity: Map<string, ConnectionStrength>,
  sccs: StrongComponent[],
): ResourceCluster[] {
  const resources = template.Resources ?? {};
  const assigned = new Set<string>();
  const clusters: ResourceCluster[] = [];
  let clusterId = 0;

  // First, ensure SCCs stay together
  for (const scc of sccs.filter((s) => s.isCyclic)) {
    const resourceIds = scc.resourceIds;
    const types: Record<string, number> = {};
    for (const id of resourceIds) {
      const t = resources[id]?.Type ?? 'Unknown';
      types[t] = (types[t] ?? 0) + 1;
      assigned.add(id);
    }
    clusters.push({
      id: `cluster-${clusterId++}`,
      name: `SCC-${clusterId}`,
      category: 'Mixed',
      resourceIds,
      resourceTypes: types,
      score: {
        clusterId: '',
        cohesion: 0,
        coupling: 0,
        size: resourceIds.length,
        sizePercent: 0,
        quality: 0,
      },
    });
  }

  // Group remaining resources by connectivity
  const remaining = Array.from(graph.resourceIds).filter((id) => !assigned.has(id));

  for (const resourceId of remaining) {
    if (assigned.has(resourceId)) continue;

    // Start a new cluster
    const clusterResources = [resourceId];
    assigned.add(resourceId);

    // Greedily add strongly connected neighbors
    const toExplore = [resourceId];
    while (toExplore.length > 0) {
      const current = toExplore.shift()!; // Use shift for breadth-first
      const node = graph.nodes.get(current);
      if (!node) continue;

      const neighbors = [...node.dependsOn, ...node.dependedOnBy];
      for (const neighbor of neighbors) {
        if (assigned.has(neighbor) || !remaining.includes(neighbor)) continue;

        // Check connection strength
        const key1 = `${current}:${neighbor}`;
        const key2 = `${neighbor}:${current}`;
        const strength = connectivity.get(key1) ?? connectivity.get(key2);

        // Lower threshold to catch more connections, or add if any connection exists
        if (strength && strength.score >= 20) {
          clusterResources.push(neighbor);
          assigned.add(neighbor);
          toExplore.push(neighbor);
        }
      }
    }

    const types: Record<string, number> = {};
    for (const id of clusterResources) {
      const t = resources[id]?.Type ?? 'Unknown';
      types[t] = (types[t] ?? 0) + 1;
    }

    clusters.push({
      id: `cluster-${clusterId++}`,
      name: `ConnectedGroup-${clusterId}`,
      category: 'Mixed',
      resourceIds: clusterResources.sort(),
      resourceTypes: types,
      score: {
        clusterId: '',
        cohesion: 0,
        coupling: 0,
        size: clusterResources.length,
        sizePercent: 0,
        quality: 0,
      },
    });
  }

  return clusters;
}

// ── Merge By Connectivity ────────────────────────────────────────────────────

/**
 * Merge semantic clusters based on connectivity strength.
 */
function mergeByConnectivity(
  clusters: ResourceCluster[],
  connectivity: Map<string, ConnectionStrength>,
  sccs: StrongComponent[],
  graph: DependencyGraph,
): ResourceCluster[] {
  // Ensure SCCs stay together
  const sccResourceSets = sccs.filter((s) => s.isCyclic).map((s) => new Set(s.resourceIds));

  // Build resource → cluster mapping
  const resourceToCluster = new Map<string, number>();
  for (let i = 0; i < clusters.length; i++) {
    for (const id of clusters[i].resourceIds) {
      resourceToCluster.set(id, i);
    }
  }

  // Build cluster connection strength matrix
  const clusterConnections = new Map<string, number>();

  for (const [key, strength] of connectivity) {
    const sourceCluster = resourceToCluster.get(strength.source);
    const targetCluster = resourceToCluster.get(strength.target);

    if (
      sourceCluster !== undefined &&
      targetCluster !== undefined &&
      sourceCluster !== targetCluster
    ) {
      const clusterKey =
        sourceCluster < targetCluster
          ? `${sourceCluster}:${targetCluster}`
          : `${targetCluster}:${sourceCluster}`;
      const existing = clusterConnections.get(clusterKey) ?? 0;
      clusterConnections.set(clusterKey, existing + strength.score);
    }
  }

  // Greedy merging: merge highest-connection cluster pairs
  const merged = new Map<number, number>(); // old cluster → new cluster

  const sortedConnections = Array.from(clusterConnections.entries()).sort((a, b) => b[1] - a[1]);

  for (const [key, _score] of sortedConnections) {
    const [c1Str, c2Str] = key.split(':');
    let c1 = parseInt(c1Str);
    let c2 = parseInt(c2Str);

    // Follow merge chains
    while (merged.has(c1)) c1 = merged.get(c1)!;
    while (merged.has(c2)) c2 = merged.get(c2)!;

    if (c1 === c2) continue;

    // Check if merging would violate SCC constraints
    const cluster1Resources = new Set(clusters[c1].resourceIds);
    const cluster2Resources = new Set(clusters[c2].resourceIds);
    let canMerge = true;

    for (const sccSet of sccResourceSets) {
      const inC1 = Array.from(sccSet).filter((r) => cluster1Resources.has(r)).length;
      const inC2 = Array.from(sccSet).filter((r) => cluster2Resources.has(r)).length;
      if (inC1 > 0 && inC2 > 0 && inC1 + inC2 < sccSet.size) {
        canMerge = false;
        break;
      }
    }

    if (!canMerge) continue;

    // Merge c2 into c1
    clusters[c1].resourceIds.push(...clusters[c2].resourceIds);
    clusters[c1].resourceIds.sort();
    for (const [type, count] of Object.entries(clusters[c2].resourceTypes)) {
      clusters[c1].resourceTypes[type] = (clusters[c1].resourceTypes[type] ?? 0) + count;
    }
    merged.set(c2, c1);
  }

  // Build final cluster list
  const finalClusters: ResourceCluster[] = [];
  for (let i = 0; i < clusters.length; i++) {
    if (!merged.has(i)) {
      finalClusters.push(clusters[i]);
    }
  }

  // Reassign IDs and names
  for (let i = 0; i < finalClusters.length; i++) {
    finalClusters[i].id = `cluster-${i}`;
    finalClusters[i].score.size = finalClusters[i].resourceIds.length;
  }

  return finalClusters;
}

// ── Cluster Optimization ─────────────────────────────────────────────────────

/**
 * Refine clusters to improve quality scores and satisfy constraints.
 */
export function optimizeClusters(
  clusters: ResourceCluster[],
  graph: DependencyGraph,
  connectivity: Map<string, ConnectionStrength>,
): ResourceCluster[] {
  let improved = true;
  let iterations = 0;

  while (improved && iterations < MAX_OPTIMIZATION_ITERATIONS) {
    improved = false;
    iterations++;

    // Score all clusters
    const clusterMap = new Map(clusters.map((c) => [c.id, c.resourceIds]));
    for (const cluster of clusters) {
      cluster.score = scoreCluster(cluster.id, cluster.resourceIds, graph, clusterMap);
    }

    // Try moving each resource to adjacent clusters
    for (const cluster of clusters) {
      for (const resourceId of [...cluster.resourceIds]) {
        const bestMove = findBestMove(resourceId, cluster, clusters, graph, connectivity);
        if (bestMove && bestMove.improvement > MIN_IMPROVEMENT_THRESHOLD) {
          // Move resource
          cluster.resourceIds = cluster.resourceIds.filter((id) => id !== resourceId);
          bestMove.targetCluster.resourceIds.push(resourceId);
          bestMove.targetCluster.resourceIds.sort();

          // Update resource types
          const resourceType = graph.nodes.get(resourceId)?.resourceType ?? 'Unknown';
          cluster.resourceTypes[resourceType] = Math.max(
            0,
            (cluster.resourceTypes[resourceType] ?? 1) - 1,
          );
          if (cluster.resourceTypes[resourceType] === 0) {
            delete cluster.resourceTypes[resourceType];
          }
          bestMove.targetCluster.resourceTypes[resourceType] =
            (bestMove.targetCluster.resourceTypes[resourceType] ?? 0) + 1;

          improved = true;
        }
      }
    }
  }

  return clusters;
}

/**
 * Find the best cluster to move a resource to (if any).
 */
function findBestMove(
  resourceId: string,
  currentCluster: ResourceCluster,
  allClusters: ResourceCluster[],
  graph: DependencyGraph,
  connectivity: Map<string, ConnectionStrength>,
): { targetCluster: ResourceCluster; improvement: number } | null {
  const node = graph.nodes.get(resourceId);
  if (!node) return null;

  const currentScore = currentCluster.score.quality;
  let bestMove: { targetCluster: ResourceCluster; improvement: number } | null = null;

  // Find adjacent clusters (clusters with connected resources)
  const adjacentClusters = new Set<ResourceCluster>();
  for (const neighbor of [...node.dependsOn, ...node.dependedOnBy]) {
    for (const cluster of allClusters) {
      if (cluster !== currentCluster && cluster.resourceIds.includes(neighbor)) {
        adjacentClusters.add(cluster);
      }
    }
  }

  for (const targetCluster of adjacentClusters) {
    // Simulate the move
    const newCurrentResources = currentCluster.resourceIds.filter((id) => id !== resourceId);
    const newTargetResources = [...targetCluster.resourceIds, resourceId];

    const clusterMap = new Map<string, string[]>();
    for (const c of allClusters) {
      if (c === currentCluster) {
        clusterMap.set(c.id, newCurrentResources);
      } else if (c === targetCluster) {
        clusterMap.set(c.id, newTargetResources);
      } else {
        clusterMap.set(c.id, c.resourceIds);
      }
    }

    const newCurrentScore = scoreCluster(currentCluster.id, newCurrentResources, graph, clusterMap);
    const newTargetScore = scoreCluster(targetCluster.id, newTargetResources, graph, clusterMap);

    const improvement =
      newCurrentScore.quality + newTargetScore.quality - currentScore - targetCluster.score.quality;

    if (improvement > 0 && (!bestMove || improvement > bestMove.improvement)) {
      bestMove = { targetCluster, improvement };
    }
  }

  return bestMove;
}

// ── Constraint Enforcement ───────────────────────────────────────────────────

/**
 * Enforce size constraints by splitting oversized clusters.
 */
export function enforceConstraints(
  clusters: ResourceCluster[],
  graph: DependencyGraph,
  maxSize: number,
): ResourceCluster[] {
  const result: ResourceCluster[] = [];

  for (const cluster of clusters) {
    if (cluster.resourceIds.length <= maxSize) {
      result.push(cluster);
    } else {
      // Split oversized cluster
      const splitClusters = splitCluster(cluster, graph, maxSize);
      result.push(...splitClusters);
    }
  }

  return result;
}

/**
 * Split an oversized cluster into smaller ones while preserving connectivity.
 */
function splitCluster(
  cluster: ResourceCluster,
  graph: DependencyGraph,
  maxSize: number,
): ResourceCluster[] {
  const resources = [...cluster.resourceIds];
  const assigned = new Set<string>();
  const subclusters: ResourceCluster[] = [];
  let subclusterId = 0;

  while (assigned.size < resources.length) {
    const subclusterResources: string[] = [];

    // Start with an unassigned resource
    for (const r of resources) {
      if (!assigned.has(r)) {
        subclusterResources.push(r);
        assigned.add(r);
        break;
      }
    }

    // Greedily add connected resources until size limit
    const toExplore = [...subclusterResources];
    while (toExplore.length > 0 && subclusterResources.length < maxSize) {
      const current = toExplore.pop()!;
      const node = graph.nodes.get(current);
      if (!node) continue;

      const neighbors = [...node.dependsOn, ...node.dependedOnBy];
      for (const neighbor of neighbors) {
        if (
          !assigned.has(neighbor) &&
          resources.includes(neighbor) &&
          subclusterResources.length < maxSize
        ) {
          subclusterResources.push(neighbor);
          assigned.add(neighbor);
          toExplore.push(neighbor);
        }
      }
    }

    const types: Record<string, number> = {};
    for (const id of subclusterResources) {
      const t = graph.nodes.get(id)?.resourceType ?? 'Unknown';
      types[t] = (types[t] ?? 0) + 1;
    }

    subclusters.push({
      id: `${cluster.id}-split-${subclusterId++}`,
      name: `${cluster.name}-${subclusterId}`,
      category: cluster.category,
      resourceIds: subclusterResources.sort(),
      resourceTypes: types,
      score: {
        clusterId: '',
        cohesion: 0,
        coupling: 0,
        size: subclusterResources.length,
        sizePercent: 0,
        quality: 0,
      },
    });
  }

  return subclusters;
}
