/**
 * Split Suggestion Generation & Reporting (Phase 4.2 of #90)
 *
 * Provides:
 * - Multiple split strategy options (connectivity, semantic, hybrid)
 * - Detailed analysis reports
 * - Anti-pattern detection
 * - Opportunity identification
 */

import type { TemplateDocument } from '../types/template.js';
import type { DependencyGraph } from './graph.js';
import { clusterResources, type ResourceCluster } from './clustering.js';
import type { CrossStackDependency } from './split.js';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * A complete split suggestion with multiple options.
 */
export interface SplitSuggestion {
  /** Primary recommended split */
  recommended: SplitOption;
  /** Alternative split strategies */
  alternatives: SplitOption[];
  /** Analysis of why split is needed */
  analysis: SplitAnalysis;
}

/**
 * One possible way to split the template.
 */
export interface SplitOption {
  strategy: string;
  clusters: ResourceCluster[];
  crossStackDeps: CrossStackDependency[];
  deploymentOrder: string[];
  /** Overall quality score for this option */
  overallScore: number;
  /** Estimated deployment time in minutes */
  estimatedDeploymentMin: number;
}

/**
 * Why the template needs splitting.
 */
export interface SplitAnalysis {
  exceedsLimits: boolean;
  resourceOverage: number;
  outputOverage: number;
  sizeOverage: number;
  /** Detected anti-patterns (e.g., monolithic, spaghetti deps) */
  antiPatterns: string[];
  /** Opportunities for improvement */
  opportunities: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CFN_RESOURCE_LIMIT = 500;
const CFN_OUTPUT_LIMIT = 200;
const CFN_TEMPLATE_BYTES_LIMIT = 51200; // 51,200 bytes (template body limit)
const EST_DEPLOY_TIME_PER_STACK = 5; // minutes
const EST_DEPLOY_TIME_PER_DEP = 0.5; // minutes per cross-stack dependency

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Generate split suggestions with multiple strategies.
 */
export function generateSplitSuggestions(
  template: TemplateDocument,
  graph: DependencyGraph,
): SplitSuggestion {
  // Analyze current state
  const stats = computeStats(template);
  const analysis: SplitAnalysis = {
    exceedsLimits:
      stats.resourcePercent > 100 || stats.outputPercent > 100 || stats.templatePercent > 100,
    resourceOverage: Math.max(0, stats.resourceCount - CFN_RESOURCE_LIMIT),
    outputOverage: Math.max(0, stats.outputCount - CFN_OUTPUT_LIMIT),
    sizeOverage: Math.max(0, stats.templateBytes - CFN_TEMPLATE_BYTES_LIMIT),
    antiPatterns: detectAntiPatterns(template, graph),
    opportunities: detectOpportunities(template, graph),
  };

  // Generate multiple split strategies
  const options: SplitOption[] = [];

  // Option 1: Hybrid (default, recommended)
  const hybridClusters = clusterResources(template, graph, { strategy: 'hybrid' });
  options.push(buildSplitOption('Hybrid (Recommended)', hybridClusters, graph));

  // Option 2: Semantic grouping
  const semanticClusters = clusterResources(template, graph, { strategy: 'semantic' });
  options.push(buildSplitOption('Semantic Grouping', semanticClusters, graph));

  // Option 3: Connectivity-based
  const connectivityClusters = clusterResources(template, graph, { strategy: 'connectivity' });
  options.push(buildSplitOption('Connectivity-Based', connectivityClusters, graph));

  const ranked = rankSuggestions(options);

  return {
    recommended: ranked[0],
    alternatives: ranked.slice(1),
    analysis,
  };
}

/**
 * Rank split options by quality score.
 */
export function rankSuggestions(options: SplitOption[]): SplitOption[] {
  return options.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Format detailed report with charts and recommendations.
 */
export function formatDetailedReport(suggestion: SplitSuggestion): string {
  const lines: string[] = [];

  lines.push('╔═══════════════════════════════════════════════════════════════╗');
  lines.push('║         CloudFormation Stack Split Analysis                  ║');
  lines.push('╚═══════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Analysis section
  const { analysis } = suggestion;
  if (analysis.exceedsLimits) {
    lines.push('⚠️  TEMPLATE EXCEEDS CLOUDFORMATION LIMITS');
    if (analysis.resourceOverage > 0) {
      lines.push(`   Resources: ${analysis.resourceOverage} over limit`);
    }
    if (analysis.outputOverage > 0) {
      lines.push(`   Outputs: ${analysis.outputOverage} over limit`);
    }
    if (analysis.sizeOverage > 0) {
      lines.push(`   Size: ${formatBytes(analysis.sizeOverage)} over limit`);
    }
  } else {
    lines.push('ℹ️  Template within limits but split recommended for:');
  }
  lines.push('');

  if (analysis.antiPatterns.length > 0) {
    lines.push('🚨 Anti-Patterns Detected:');
    for (const pattern of analysis.antiPatterns) {
      lines.push(`   • ${pattern}`);
    }
    lines.push('');
  }

  if (analysis.opportunities.length > 0) {
    lines.push('💡 Opportunities:');
    for (const opp of analysis.opportunities) {
      lines.push(`   • ${opp}`);
    }
    lines.push('');
  }

  // Recommended split
  const rec = suggestion.recommended;
  lines.push(`📦 RECOMMENDED: ${rec.strategy}`);
  lines.push(`   Quality Score: ${(rec.overallScore * 100).toFixed(1)}%`);
  lines.push(`   Stacks: ${rec.clusters.length}`);
  lines.push(`   Cross-Stack Refs: ${rec.crossStackDeps.length}`);
  lines.push(`   Est. Deployment: ${rec.estimatedDeploymentMin} min`);
  lines.push('');

  lines.push('Deployment Order:');
  lines.push(`   ${rec.deploymentOrder.join(' → ')}`);
  lines.push('');

  // Cluster details
  for (const cluster of rec.clusters) {
    lines.push(`Stack: ${cluster.name} (${cluster.resourceIds.length} resources)`);
    lines.push(`   Category: ${cluster.category}`);
    lines.push(
      `   Quality: Cohesion=${cluster.score.cohesion.toFixed(2)}, Coupling=${cluster.score.coupling.toFixed(2)}`,
    );
    lines.push(`   Size: ${cluster.score.sizePercent.toFixed(1)}% of limit`);

    const topTypes = Object.entries(cluster.resourceTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    lines.push('   Top Resources:');
    for (const [type, count] of topTypes) {
      lines.push(`      ${type}: ${count}`);
    }
    lines.push('');
  }

  // Alternatives
  if (suggestion.alternatives.length > 0) {
    lines.push('Alternative Strategies:');
    for (const alt of suggestion.alternatives) {
      lines.push(`   ${alt.strategy} (score: ${(alt.overallScore * 100).toFixed(1)}%)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Compute basic template statistics.
 */
function computeStats(template: TemplateDocument) {
  const resourceCount = Object.keys(template.Resources ?? {}).length;
  const outputCount = Object.keys(template.Outputs ?? {}).length;
  const templateBytes = JSON.stringify(template).length;

  return {
    resourceCount,
    outputCount,
    templateBytes,
    resourcePercent: (resourceCount / CFN_RESOURCE_LIMIT) * 100,
    outputPercent: (outputCount / CFN_OUTPUT_LIMIT) * 100,
    templatePercent: (templateBytes / CFN_TEMPLATE_BYTES_LIMIT) * 100,
  };
}

/**
 * Build a SplitOption from clusters.
 */
function buildSplitOption(
  strategy: string,
  clusters: ResourceCluster[],
  graph: DependencyGraph,
): SplitOption {
  // Build resource → cluster mapping
  const resourceToCluster = new Map<string, string>();
  for (const cluster of clusters) {
    for (const id of cluster.resourceIds) {
      resourceToCluster.set(id, cluster.name);
    }
  }

  // Find cross-stack dependencies
  const crossStackDeps: CrossStackDependency[] = [];
  for (const edge of graph.edges) {
    const sg = resourceToCluster.get(edge.source);
    const tg = resourceToCluster.get(edge.target);
    if (sg && tg && sg !== tg) {
      crossStackDeps.push({
        sourceStack: sg,
        targetStack: tg,
        sourceResource: edge.source,
        targetResource: edge.target,
        edge,
      });
    }
  }

  // Compute deployment order (convert clusters to groups for compatibility)
  const groups = clusters.map((c) => ({
    name: c.name,
    category: c.category,
    resourceIds: c.resourceIds,
    resourceTypes: c.resourceTypes,
  }));
  const deploymentOrder = topoSortGroups(groups, crossStackDeps);

  // Compute overall quality score
  const avgClusterQuality =
    clusters.reduce((sum, c) => sum + c.score.quality, 0) / Math.max(1, clusters.length);
  const crossStackPenalty = crossStackDeps.length / Math.max(1, graph.edges.length);
  const overallScore = Math.max(0, avgClusterQuality - crossStackPenalty * 0.3);

  // Estimate deployment time
  const estimatedDeploymentMin =
    clusters.length * EST_DEPLOY_TIME_PER_STACK + crossStackDeps.length * EST_DEPLOY_TIME_PER_DEP;

  return {
    strategy,
    clusters,
    crossStackDeps,
    deploymentOrder,
    overallScore,
    estimatedDeploymentMin: Math.ceil(estimatedDeploymentMin),
  };
}

/**
 * Detect anti-patterns in the template.
 */
function detectAntiPatterns(template: TemplateDocument, graph: DependencyGraph): string[] {
  const patterns: string[] = [];
  const resourceCount = Object.keys(template.Resources ?? {}).length;

  // Monolithic stack
  if (resourceCount > 200) {
    patterns.push('Monolithic stack: all resources in single template');
  }

  // High coupling
  const avgDepsPerResource =
    Array.from(graph.nodes.values()).reduce((sum, n) => sum + n.dependsOn.size, 0) /
    Math.max(1, resourceCount);
  if (avgDepsPerResource > 5) {
    patterns.push(`High coupling: average ${avgDepsPerResource.toFixed(1)} dependencies per resource`);
  }

  // Circular dependencies
  const sccs = Array.from(graph.nodes.values()).filter((n) => n.dependsOn.size > 0);
  if (sccs.length > resourceCount * 0.1) {
    patterns.push('Potential circular dependencies detected');
  }

  return patterns;
}

/**
 * Detect optimization opportunities.
 */
function detectOpportunities(template: TemplateDocument, graph: DependencyGraph): string[] {
  const opportunities: string[] = [];
  const resources = template.Resources ?? {};

  // Check for clear layer boundaries
  const categories = new Set<string>();
  for (const resource of Object.values(resources)) {
    const type = resource.Type ?? 'Unknown';
    if (type.startsWith('AWS::EC2::VPC') || type.startsWith('AWS::EC2::Subnet')) {
      categories.add('Networking');
    } else if (type.startsWith('AWS::Lambda') || type.startsWith('AWS::ECS')) {
      categories.add('Compute');
    } else if (type.startsWith('AWS::DynamoDB') || type.startsWith('AWS::RDS')) {
      categories.add('Data');
    } else if (type.startsWith('AWS::IAM')) {
      categories.add('IAM');
    }
  }

  if (categories.has('Networking') && categories.has('Compute')) {
    opportunities.push('Natural boundary between Networking and Compute layers');
  }

  if (categories.has('Data')) {
    opportunities.push('Data layer can be independent stack for reusability');
  }

  if (categories.has('IAM')) {
    opportunities.push('IAM roles can be extracted to separate stack');
  }

  // Check for reusable components
  const typeCount = new Map<string, number>();
  for (const resource of Object.values(resources)) {
    const type = resource.Type ?? 'Unknown';
    typeCount.set(type, (typeCount.get(type) ?? 0) + 1);
  }

  for (const [type, count] of typeCount) {
    if (count > 10 && (type.includes('Lambda') || type.includes('DynamoDB'))) {
      opportunities.push(`${count} ${type} resources could be a reusable module`);
    }
  }

  return opportunities;
}

/**
 * Format bytes as human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Import helper from split.ts ──────────────────────────────────────────────

/**
 * Topological sort of groups based on cross-stack deps.
 * (This is a copy from split.ts to avoid circular dependencies)
 */
function topoSortGroups(
  groups: Array<{ name: string; resourceIds: string[] }>,
  deps: CrossStackDependency[],
): string[] {
  const names = groups.map((g) => g.name);
  const inDegree = new Map<string, number>();
  const adj = new Map<string, Set<string>>();
  for (const n of names) {
    inDegree.set(n, 0);
    adj.set(n, new Set());
  }

  // edge: sourceStack depends on targetStack → targetStack must deploy first
  const edgeSet = new Set<string>();
  for (const dep of deps) {
    const key = `${dep.targetStack}→${dep.sourceStack}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      adj.get(dep.targetStack)!.add(dep.sourceStack);
      inDegree.set(dep.sourceStack, (inDegree.get(dep.sourceStack) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [n, d] of inDegree) {
    if (d === 0) queue.push(n);
  }
  queue.sort();

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        // Insert sorted for deterministic output
        const idx = queue.findIndex((q) => q.localeCompare(neighbor) > 0);
        if (idx === -1) queue.push(neighbor);
        else queue.splice(idx, 0, neighbor);
      }
    }
  }

  // If there are cycles, append remaining groups
  for (const n of names) {
    if (!order.includes(n)) order.push(n);
  }

  return order;
}
