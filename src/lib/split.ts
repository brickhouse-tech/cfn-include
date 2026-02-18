/**
 * Template Split Strategy & Execution (Phases 2 & 3 of #90)
 *
 * Provides:
 * - `suggestSplit()` — analyze a template and suggest how to break it into stacks
 * - `autoSplit()` — generate the actual child + parent stack templates
 *
 * Cross-stack references are wired via CloudFormation Exports / Fn::ImportValue,
 * similar to how AWS CDK handles cross-stack references.
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-exports.html
 */

import type { TemplateDocument, TemplateValue, Resource, Output } from '../types/template.js';
import type { DependencyGraph, DependencyEdge } from './graph.js';

// ── Category Heuristics ──────────────────────────────────────────────────────

/**
 * Resource type prefix → category mapping.
 * Order matters: more specific prefixes should come first.
 */
export const CATEGORY_RULES: Array<{ prefixes: string[]; category: string }> = [
  {
    category: 'Networking',
    prefixes: [
      'AWS::EC2::VPC', 'AWS::EC2::Subnet', 'AWS::EC2::SecurityGroup',
      'AWS::EC2::RouteTable', 'AWS::EC2::Route', 'AWS::EC2::NatGateway',
      'AWS::EC2::InternetGateway', 'AWS::EC2::VPCGatewayAttachment',
      'AWS::EC2::EIP', 'AWS::EC2::NetworkInterface', 'AWS::EC2::NetworkAcl',
      'AWS::EC2::SubnetRouteTableAssociation', 'AWS::EC2::SubnetNetworkAclAssociation',
      'AWS::EC2::VPCEndpoint', 'AWS::EC2::VPNGateway', 'AWS::EC2::DHCPOptions',
      'AWS::EC2::TransitGateway', 'AWS::EC2::PrefixList',
      'AWS::ElasticLoadBalancing::', 'AWS::ElasticLoadBalancingV2::',
      'AWS::Route53::', 'AWS::CloudFront::',
      'AWS::ApiGateway::', 'AWS::ApiGatewayV2::',
    ],
  },
  {
    category: 'Compute',
    prefixes: [
      'AWS::Lambda::', 'AWS::EC2::Instance', 'AWS::EC2::LaunchTemplate',
      'AWS::ECS::', 'AWS::EKS::', 'AWS::AutoScaling::',
      'AWS::Batch::', 'AWS::StepFunctions::', 'AWS::AppRunner::',
    ],
  },
  {
    category: 'Data',
    prefixes: [
      'AWS::DynamoDB::', 'AWS::RDS::', 'AWS::S3::', 'AWS::ElastiCache::',
      'AWS::Redshift::', 'AWS::Neptune::', 'AWS::DocumentDB::',
      'AWS::Kinesis::', 'AWS::OpenSearchService::', 'AWS::Elasticsearch::',
      'AWS::DAX::', 'AWS::Athena::',
    ],
  },
  {
    category: 'IAM',
    prefixes: [
      'AWS::IAM::Role', 'AWS::IAM::Policy', 'AWS::IAM::InstanceProfile',
      'AWS::IAM::ManagedPolicy', 'AWS::IAM::User', 'AWS::IAM::Group',
      'AWS::IAM::AccessKey', 'AWS::IAM::ServiceLinkedRole',
    ],
  },
  {
    category: 'Monitoring',
    prefixes: [
      'AWS::CloudWatch::', 'AWS::SNS::', 'AWS::SQS::',
      'AWS::Logs::', 'AWS::Events::', 'AWS::ApplicationAutoScaling::',
      'AWS::CloudTrail::', 'AWS::Config::',
    ],
  },
];

/** Fallback category for unmatched resource types. */
export const DEFAULT_CATEGORY = 'Other';

/** Classify a CloudFormation resource type into a category. */
export function categorizeResource(resourceType: string): string {
  for (const rule of CATEGORY_RULES) {
    for (const prefix of rule.prefixes) {
      if (resourceType.startsWith(prefix)) return rule.category;
    }
  }
  return DEFAULT_CATEGORY;
}

// ── Types ────────────────────────────────────────────────────────────────────

/** A group of resources proposed to live in one stack. */
export interface ResourceGroup {
  name: string;
  category: string;
  resourceIds: string[];
  /** Resource types summary. */
  resourceTypes: Record<string, number>;
}

/** A dependency that crosses stack boundaries. */
export interface CrossStackDependency {
  sourceStack: string;
  targetStack: string;
  sourceResource: string;
  targetResource: string;
  edge: DependencyEdge;
}

/** Output of `suggestSplit`. */
export interface SplitSuggestion {
  groups: ResourceGroup[];
  crossStackDependencies: CrossStackDependency[];
  /** Topological deployment order (group names). */
  deploymentOrder: string[];
}

/** Options for suggestSplit / autoSplit. */
export interface SplitOptions {
  /** Whether to generate a parent orchestrator stack. Default: true. */
  generateParent?: boolean;
  /** Stack name prefix for exports. Default: template description or 'Stack'. */
  stackPrefix?: string;
}

/** A generated child stack template + metadata. */
export interface GeneratedStack {
  name: string;
  template: TemplateDocument;
  /** Resources in this stack. */
  resourceIds: string[];
}

/** Output of `autoSplit`. */
export interface SplitResult {
  stacks: GeneratedStack[];
  parent?: GeneratedStack;
  suggestion: SplitSuggestion;
}

// ── Phase 2: suggestSplit ────────────────────────────────────────────────────

/**
 * Analyze a template's dependency graph and suggest how to split it into stacks.
 */
export function suggestSplit(
  template: TemplateDocument,
  graph: DependencyGraph,
  options?: SplitOptions,
): SplitSuggestion {
  const resources = template.Resources ?? {};

  // Group resources by category
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

  // Build groups
  const groups: ResourceGroup[] = [];
  for (const [category, ids] of categoryMap) {
    const types: Record<string, number> = {};
    for (const id of ids) {
      const t = resources[id]?.Type ?? 'Unknown';
      types[t] = (types[t] ?? 0) + 1;
    }
    groups.push({
      name: category,
      category,
      resourceIds: ids.sort(),
      resourceTypes: types,
    });
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));

  // Build resource → group mapping
  const resourceToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const id of g.resourceIds) resourceToGroup.set(id, g.name);
  }

  // Find cross-stack dependencies
  const crossStackDependencies: CrossStackDependency[] = [];
  for (const edge of graph.edges) {
    const sg = resourceToGroup.get(edge.source);
    const tg = resourceToGroup.get(edge.target);
    if (sg && tg && sg !== tg) {
      crossStackDependencies.push({
        sourceStack: sg,
        targetStack: tg,
        sourceResource: edge.source,
        targetResource: edge.target,
        edge,
      });
    }
  }

  // Compute deployment order via topological sort of group dependency DAG
  const deploymentOrder = topoSortGroups(groups, crossStackDependencies);

  return { groups, crossStackDependencies, deploymentOrder };
}

/**
 * Topological sort of groups based on cross-stack deps.
 * Groups that are depended upon deploy first.
 */
function topoSortGroups(groups: ResourceGroup[], deps: CrossStackDependency[]): string[] {
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

/**
 * Format a split suggestion as a human-readable report.
 */
export function formatSplitReport(suggestion: SplitSuggestion): string {
  const lines: string[] = [
    'Stack Split Suggestion',
    '======================',
    '',
  ];

  lines.push(`Deployment Order: ${suggestion.deploymentOrder.join(' → ')}`);
  lines.push('');

  for (const group of suggestion.groups) {
    lines.push(`📦 ${group.name} (${group.resourceIds.length} resources)`);
    const types = Object.entries(group.resourceTypes).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of types) {
      lines.push(`   ${type}: ${count}`);
    }
    lines.push(`   Resources: ${group.resourceIds.join(', ')}`);
    lines.push('');
  }

  if (suggestion.crossStackDependencies.length > 0) {
    lines.push('Cross-Stack Dependencies:');
    const seen = new Set<string>();
    for (const dep of suggestion.crossStackDependencies) {
      const key = `${dep.sourceResource}→${dep.targetResource}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`  ${dep.sourceStack}::${dep.sourceResource} → ${dep.targetStack}::${dep.targetResource} (${dep.edge.type}${dep.edge.attribute ? `:${dep.edge.attribute}` : ''})`);
    }
  } else {
    lines.push('No cross-stack dependencies detected.');
  }

  return lines.join('\n');
}

// ── Phase 3: autoSplit ───────────────────────────────────────────────────────

/**
 * Generate actual split stack templates from a suggestion.
 */
export function autoSplit(
  template: TemplateDocument,
  graph: DependencyGraph,
  suggestion?: SplitSuggestion,
  options?: SplitOptions,
): SplitResult {
  const opts: Required<SplitOptions> = {
    generateParent: options?.generateParent ?? true,
    stackPrefix: options?.stackPrefix ?? 'Stack',
  };

  const sug = suggestion ?? suggestSplit(template, graph, options);
  const resources = template.Resources ?? {};

  // Build resource → group mapping
  const resourceToGroup = new Map<string, string>();
  for (const g of sug.groups) {
    for (const id of g.resourceIds) resourceToGroup.set(id, g.name);
  }

  // Determine which resources need to be exported (referenced from another stack)
  // Key: `logicalId` or `logicalId.attribute` → set of target stacks
  const exportsNeeded = new Map<string, { logicalId: string; attribute?: string; targetStacks: Set<string> }>();

  for (const dep of sug.crossStackDependencies) {
    const key = dep.edge.type === 'Fn::GetAtt' && dep.edge.attribute
      ? `${dep.targetResource}.${dep.edge.attribute}`
      : dep.targetResource;

    let entry = exportsNeeded.get(key);
    if (!entry) {
      entry = {
        logicalId: dep.targetResource,
        attribute: dep.edge.type === 'Fn::GetAtt' ? dep.edge.attribute : undefined,
        targetStacks: new Set(),
      };
      exportsNeeded.set(key, entry);
    }
    entry.targetStacks.add(dep.sourceStack);
  }

  // Generate child stacks
  const stacks: GeneratedStack[] = [];

  for (const group of sug.groups) {
    const resourceIdsInGroup = new Set(group.resourceIds);
    const childResources: Record<string, Resource> = {};
    for (const id of group.resourceIds) {
      childResources[id] = resources[id];
    }

    // Determine which parameters are used by this group's resources
    const usedParams = findUsedParameters(childResources, template.Parameters ?? {});
    const usedMappings = findUsedMappings(childResources, template.Mappings ?? {});
    const usedConditions = findUsedConditions(childResources, template.Conditions ?? {});

    // Build the child template
    const childTemplate: TemplateDocument = {};
    if (template.AWSTemplateFormatVersion) {
      childTemplate.AWSTemplateFormatVersion = template.AWSTemplateFormatVersion;
    }
    childTemplate.Description = `${template.Description ?? 'CloudFormation Stack'} - ${group.name}`;

    if (Object.keys(usedParams).length > 0) childTemplate.Parameters = usedParams;
    if (Object.keys(usedMappings).length > 0) childTemplate.Mappings = usedMappings;
    if (Object.keys(usedConditions).length > 0) childTemplate.Conditions = usedConditions;

    // Rewrite resources: replace cross-stack Ref/GetAtt with Fn::ImportValue
    const rewrittenResources: Record<string, Resource> = {};
    for (const [id, resource] of Object.entries(childResources)) {
      rewrittenResources[id] = rewriteResource(resource, resourceToGroup, group.name, opts.stackPrefix);
    }
    childTemplate.Resources = rewrittenResources;

    // Add exports for resources that other stacks reference
    const childOutputs: Record<string, Output> = {};

    // Carry over existing outputs that reference resources in this group
    if (template.Outputs) {
      for (const [outId, output] of Object.entries(template.Outputs)) {
        const refs = findRefsInValue(output.Value, new Set(Object.keys(resources)));
        if (refs.some((r) => resourceIdsInGroup.has(r))) {
          childOutputs[outId] = output;
        }
      }
    }

    // Add cross-stack exports
    for (const [key, entry] of exportsNeeded) {
      if (!resourceIdsInGroup.has(entry.logicalId)) continue;

      const exportName = makeExportName(opts.stackPrefix, group.name, entry.logicalId, entry.attribute);
      const outputLogicalId = makeOutputLogicalId(entry.logicalId, entry.attribute);

      const outputValue: TemplateValue = entry.attribute
        ? { 'Fn::GetAtt': [entry.logicalId, entry.attribute] }
        : { Ref: entry.logicalId };

      childOutputs[outputLogicalId] = {
        Description: `Cross-stack export for ${key}`,
        Value: outputValue,
        Export: {
          Name: { 'Fn::Sub': `\${AWS::StackName}-${exportName}` } as any,
        },
      };
    }

    if (Object.keys(childOutputs).length > 0) childTemplate.Outputs = childOutputs;

    stacks.push({
      name: group.name,
      template: childTemplate,
      resourceIds: group.resourceIds,
    });
  }

  // Generate parent orchestrator stack
  let parent: GeneratedStack | undefined;
  if (opts.generateParent) {
    parent = generateParentStack(template, sug, stacks, opts);
  }

  return { stacks, parent, suggestion: sug };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeExportName(prefix: string, groupName: string, logicalId: string, attribute?: string): string {
  const base = `${groupName}-${logicalId}`;
  return attribute ? `${base}-${attribute}` : base;
}

function makeOutputLogicalId(logicalId: string, attribute?: string): string {
  const base = `Export${logicalId}`;
  return attribute ? `${base}${attribute.replace(/[^a-zA-Z0-9]/g, '')}` : base;
}

/**
 * Deep-rewrite a resource, replacing cross-stack Ref/GetAtt with Fn::ImportValue.
 */
function rewriteResource(
  resource: Resource,
  resourceToGroup: Map<string, string>,
  currentGroup: string,
  stackPrefix: string,
): Resource {
  return JSON.parse(JSON.stringify(resource), (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Ref to another stack's resource
      if ('Ref' in value && typeof value.Ref === 'string') {
        const targetGroup = resourceToGroup.get(value.Ref);
        if (targetGroup && targetGroup !== currentGroup) {
          const exportName = makeExportName(stackPrefix, targetGroup, value.Ref);
          return {
            'Fn::ImportValue': { 'Fn::Sub': `\${AWS::StackName}-${exportName}` },
          };
        }
      }
      // Fn::GetAtt to another stack's resource
      if ('Fn::GetAtt' in value) {
        let target: string | undefined;
        let attr: string | undefined;
        const getAtt = value['Fn::GetAtt'];
        if (Array.isArray(getAtt) && getAtt.length >= 2) {
          target = getAtt[0];
          attr = String(getAtt[1]);
        } else if (typeof getAtt === 'string' && getAtt.includes('.')) {
          const dot = getAtt.indexOf('.');
          target = getAtt.substring(0, dot);
          attr = getAtt.substring(dot + 1);
        }
        if (target && attr) {
          const targetGroup = resourceToGroup.get(target);
          if (targetGroup && targetGroup !== currentGroup) {
            const exportName = makeExportName(stackPrefix, targetGroup, target, attr);
            return {
              'Fn::ImportValue': { 'Fn::Sub': `\${AWS::StackName}-${exportName}` },
            };
          }
        }
      }
    }
    return value;
  });
}

/** Find all resource logical IDs referenced (via Ref) in a template value. */
function findRefsInValue(value: TemplateValue, resourceIds: Set<string>): string[] {
  const refs: string[] = [];
  const walk = (v: TemplateValue) => {
    if (v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const obj = v as Record<string, any>;
    if ('Ref' in obj && typeof obj.Ref === 'string' && resourceIds.has(obj.Ref)) {
      refs.push(obj.Ref);
    }
    if ('Fn::GetAtt' in obj) {
      const ga = obj['Fn::GetAtt'];
      if (Array.isArray(ga) && typeof ga[0] === 'string' && resourceIds.has(ga[0])) {
        refs.push(ga[0]);
      }
    }
    Object.values(obj).forEach(walk);
  };
  walk(value);
  return refs;
}

/** Find parameters actually referenced by the given resources. */
function findUsedParameters(
  resources: Record<string, Resource>,
  allParams: Record<string, any>,
): Record<string, any> {
  const paramNames = new Set(Object.keys(allParams));
  const used = new Set<string>();
  const walk = (v: TemplateValue) => {
    if (v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const obj = v as Record<string, any>;
    if ('Ref' in obj && typeof obj.Ref === 'string' && paramNames.has(obj.Ref)) {
      used.add(obj.Ref);
    }
    // Also check Fn::Sub for ${ParamName} references
    if ('Fn::Sub' in obj) {
      const sub = obj['Fn::Sub'];
      const str = typeof sub === 'string' ? sub : Array.isArray(sub) ? sub[0] : '';
      if (typeof str === 'string') {
        for (const match of str.matchAll(/\$\{([^!}]+)\}/g)) {
          if (paramNames.has(match[1])) used.add(match[1]);
        }
      }
    }
    Object.values(obj).forEach(walk);
  };
  for (const r of Object.values(resources)) walk(r as any);
  const result: Record<string, any> = {};
  for (const p of used) result[p] = allParams[p];
  return result;
}

/** Find mappings referenced by FindInMap in the given resources. */
function findUsedMappings(
  resources: Record<string, Resource>,
  allMappings: Record<string, any>,
): Record<string, any> {
  const used = new Set<string>();
  const walk = (v: TemplateValue) => {
    if (v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const obj = v as Record<string, any>;
    if ('Fn::FindInMap' in obj) {
      const fim = obj['Fn::FindInMap'];
      if (Array.isArray(fim) && typeof fim[0] === 'string') used.add(fim[0]);
    }
    Object.values(obj).forEach(walk);
  };
  for (const r of Object.values(resources)) walk(r as any);
  const result: Record<string, any> = {};
  for (const m of used) if (allMappings[m]) result[m] = allMappings[m];
  return result;
}

/** Find conditions referenced by resources (Condition key or Fn::If). */
function findUsedConditions(
  resources: Record<string, Resource>,
  allConditions: Record<string, any>,
): Record<string, any> {
  const used = new Set<string>();
  for (const r of Object.values(resources)) {
    if (r.Condition) used.add(r.Condition);
  }
  const walk = (v: TemplateValue) => {
    if (v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    const obj = v as Record<string, any>;
    if ('Fn::If' in obj && Array.isArray(obj['Fn::If']) && typeof obj['Fn::If'][0] === 'string') {
      used.add(obj['Fn::If'][0]);
    }
    if ('Condition' in obj && typeof obj.Condition === 'string' && allConditions[obj.Condition]) {
      used.add(obj.Condition);
    }
    Object.values(obj).forEach(walk);
  };
  for (const r of Object.values(resources)) walk(r as any);
  const result: Record<string, any> = {};
  for (const c of used) if (allConditions[c]) result[c] = allConditions[c];
  return result;
}

/** Generate the parent orchestrator stack with nested stack resources. */
function generateParentStack(
  template: TemplateDocument,
  suggestion: SplitSuggestion,
  childStacks: GeneratedStack[],
  opts: Required<SplitOptions>,
): GeneratedStack {
  const parentTemplate: TemplateDocument = {};
  if (template.AWSTemplateFormatVersion) {
    parentTemplate.AWSTemplateFormatVersion = template.AWSTemplateFormatVersion;
  }
  parentTemplate.Description = `${template.Description ?? 'CloudFormation Stack'} - Parent Orchestrator`;

  // Forward all parameters
  if (template.Parameters && Object.keys(template.Parameters).length > 0) {
    parentTemplate.Parameters = { ...template.Parameters };
  }

  // Add a TemplateURLBase parameter for S3 location
  parentTemplate.Parameters = {
    ...parentTemplate.Parameters,
    TemplateURLBase: {
      Type: 'String',
      Description: 'S3 URL base where child stack templates are uploaded',
    },
  };

  const parentResources: Record<string, Resource> = {};
  const stackNameMap = new Map<string, string>();

  for (const group of suggestion.deploymentOrder) {
    const child = childStacks.find((s) => s.name === group);
    if (!child) continue;

    const stackLogicalId = `${group.replace(/[^a-zA-Z0-9]/g, '')}Stack`;
    stackNameMap.set(group, stackLogicalId);

    // Determine DependsOn from cross-stack deps
    const dependsOn = new Set<string>();
    for (const dep of suggestion.crossStackDependencies) {
      if (dep.sourceStack === group && dep.targetStack !== group) {
        const depStackId = `${dep.targetStack.replace(/[^a-zA-Z0-9]/g, '')}Stack`;
        dependsOn.add(depStackId);
      }
    }

    const nestedResource: Resource = {
      Type: 'AWS::CloudFormation::Stack',
      Properties: {
        TemplateURL: { 'Fn::Sub': `\${TemplateURLBase}/${group}.json` } as any,
      },
    };

    if (dependsOn.size > 0) {
      nestedResource.DependsOn = [...dependsOn].sort();
    }

    parentResources[stackLogicalId] = nestedResource;
  }

  parentTemplate.Resources = parentResources;

  return {
    name: 'Parent',
    template: parentTemplate,
    resourceIds: [],
  };
}
