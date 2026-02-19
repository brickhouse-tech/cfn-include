/**
 * Dependency Graph Builder for CloudFormation templates (Phase 2 of #90)
 *
 * Scans a resolved CloudFormation template and builds a directed dependency graph
 * by detecting inter-resource references via Ref, Fn::GetAtt, DependsOn, and Conditions.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference.html
 */

import type { TemplateDocument, TemplateValue } from '../types/template.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** A single directed edge in the dependency graph. */
export interface DependencyEdge {
  /** The resource that depends on `target`. */
  source: string;
  /** The resource being depended upon. */
  target: string;
  /** How the dependency was discovered. */
  type: 'Ref' | 'Fn::GetAtt' | 'DependsOn' | 'Condition';
  /** For Fn::GetAtt edges, the attribute name. */
  attribute?: string;
}

/** Metadata for a single resource node in the graph. */
export interface ResourceNode {
  logicalId: string;
  resourceType: string;
  /** Conditions this resource is gated on. */
  conditions: string[];
  /** Logical IDs this resource directly depends on (union of all edge types). */
  dependsOn: Set<string>;
  /** Logical IDs that directly depend on this resource. */
  dependedOnBy: Set<string>;
}

/** The complete dependency graph for a template. */
export interface DependencyGraph {
  /** Map of logicalId → ResourceNode. */
  nodes: Map<string, ResourceNode>;
  /** All discovered edges. */
  edges: DependencyEdge[];
  /** Set of all resource logical IDs. */
  resourceIds: Set<string>;
  /** Set of all parameter names (used to exclude Ref targets that are params). */
  parameterIds: Set<string>;
  /** Map of condition name → resource logical IDs that use it. */
  conditionUsage: Map<string, Set<string>>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** AWS pseudo-parameters that should not be treated as resource refs. */
export const PSEUDO_PARAMETERS = new Set([
  'AWS::AccountId',
  'AWS::NotificationARNs',
  'AWS::NoValue',
  'AWS::Partition',
  'AWS::Region',
  'AWS::StackId',
  'AWS::StackName',
  'AWS::URLSuffix',
]);

/**
 * Deep-walk a template value and collect all resource references.
 * Mutates `refs` in place for performance.
 */
function collectRefs(
  value: TemplateValue,
  resourceIds: Set<string>,
  parameterIds: Set<string>,
  refs: DependencyEdge[],
  source: string,
): void {
  if (value == null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, resourceIds, parameterIds, refs, source);
    return;
  }

  const obj = value as Record<string, any>;

  // Ref
  if ('Ref' in obj && typeof obj.Ref === 'string') {
    const target = obj.Ref;
    if (resourceIds.has(target) && !PSEUDO_PARAMETERS.has(target) && !parameterIds.has(target)) {
      refs.push({ source, target, type: 'Ref' });
    }
  }

  // Fn::GetAtt
  if ('Fn::GetAtt' in obj) {
    const getAtt = obj['Fn::GetAtt'];
    let target: string | undefined;
    let attribute: string | undefined;
    if (Array.isArray(getAtt) && getAtt.length >= 2 && typeof getAtt[0] === 'string') {
      target = getAtt[0];
      attribute = String(getAtt[1]);
    } else if (typeof getAtt === 'string' && getAtt.includes('.')) {
      const dot = getAtt.indexOf('.');
      target = getAtt.substring(0, dot);
      attribute = getAtt.substring(dot + 1);
    }
    if (target && resourceIds.has(target)) {
      refs.push({ source, target, type: 'Fn::GetAtt', attribute });
    }
  }

  // Recurse into all values
  for (const val of Object.values(obj)) {
    collectRefs(val, resourceIds, parameterIds, refs, source);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Build a directed dependency graph from a resolved CloudFormation template.
 *
 * @param template - A fully resolved CloudFormation template document.
 * @returns The dependency graph.
 */
export function buildDependencyGraph(template: TemplateDocument): DependencyGraph {
  const resources = template.Resources ?? {};
  const resourceIds = new Set(Object.keys(resources));
  const parameterIds = new Set(Object.keys(template.Parameters ?? {}));

  const nodes = new Map<string, ResourceNode>();
  const edges: DependencyEdge[] = [];
  const conditionUsage = new Map<string, Set<string>>();

  // Initialize nodes
  for (const [logicalId, resource] of Object.entries(resources)) {
    nodes.set(logicalId, {
      logicalId,
      resourceType: resource.Type ?? 'Unknown',
      conditions: [],
      dependsOn: new Set<string>(),
      dependedOnBy: new Set<string>(),
    });
  }

  // Collect edges
  for (const [logicalId, resource] of Object.entries(resources)) {
    const node = nodes.get(logicalId)!;

    // DependsOn
    if (resource.DependsOn) {
      const deps = Array.isArray(resource.DependsOn) ? resource.DependsOn : [resource.DependsOn];
      for (const dep of deps) {
        if (resourceIds.has(dep)) {
          edges.push({ source: logicalId, target: dep, type: 'DependsOn' });
        }
      }
    }

    // Condition
    if (resource.Condition) {
      node.conditions.push(resource.Condition);
      let set = conditionUsage.get(resource.Condition);
      if (!set) {
        set = new Set();
        conditionUsage.set(resource.Condition, set);
      }
      set.add(logicalId);

      // If another resource also uses this condition, they share a dependency via condition
      // but we don't add edges for that — it's tracked separately.
    }

    // Deep-walk Properties, Metadata, CreationPolicy, UpdatePolicy for Ref/GetAtt
    const walkTargets: TemplateValue[] = [
      resource.Properties as TemplateValue,
      resource.Metadata as TemplateValue,
      resource.CreationPolicy as TemplateValue,
      resource.UpdatePolicy as TemplateValue,
    ];
    for (const target of walkTargets) {
      if (target != null) {
        collectRefs(target, resourceIds, parameterIds, edges, logicalId);
      }
    }
  }

  // Deduplicate edges and build adjacency
  const edgeSet = new Set<string>();
  const dedupedEdges: DependencyEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.source}|${edge.target}|${edge.type}|${edge.attribute ?? ''}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      dedupedEdges.push(edge);
      const sourceNode = nodes.get(edge.source);
      const targetNode = nodes.get(edge.target);
      if (sourceNode) sourceNode.dependsOn.add(edge.target);
      if (targetNode) targetNode.dependedOnBy.add(edge.source);
    }
  }

  return {
    nodes,
    edges: dedupedEdges,
    resourceIds,
    parameterIds,
    conditionUsage,
  };
}
