/**
 * Template statistics and CloudFormation limit checks (Phase 1 of #90)
 *
 * CloudFormation hard limits:
 * - 500 resources per stack
 * - 200 outputs per stack
 * - 1MB (1,048,576 bytes) template body size
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html
 */

export interface TemplateStats {
  resourceCount: number;
  resourceLimit: number;
  resourcePercent: number;
  outputCount: number;
  outputLimit: number;
  outputPercent: number;
  templateBytes: number;
  templateLimit: number;
  templatePercent: number;
  resourceTypes: Record<string, number>;
}

export interface StatsWarning {
  message: string;
  current: number;
  limit: number;
  percent: number;
}

/**
 * CloudFormation service quotas — individual constants for true immutability.
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html
 */

/** @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html - "Resources" */
export const CFN_RESOURCE_LIMIT = 500 as const;

/** @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html - "Outputs" */
export const CFN_OUTPUT_LIMIT = 200 as const;

/** @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html - "Template body size" */
export const CFN_TEMPLATE_BYTES_LIMIT = 1_048_576 as const; // 1MB

export const CFN_LIMITS = {
  resources: CFN_RESOURCE_LIMIT,
  outputs: CFN_OUTPUT_LIMIT,
  templateBytes: CFN_TEMPLATE_BYTES_LIMIT,
} as const;

/** Warn when usage reaches this fraction of the CloudFormation limit. */
export const WARNING_THRESHOLD = 0.8 as const; // 80%

/**
 * Compute statistics for a resolved CloudFormation template.
 */
export function computeStats(template: any, serialized?: string): TemplateStats {
  const resources = template?.Resources ?? {};
  const outputs = template?.Outputs ?? {};
  const json = serialized ?? JSON.stringify(template);
  const templateBytes = Buffer.byteLength(json, 'utf8');

  const resourceTypes: Record<string, number> = {};
  for (const [, value] of Object.entries(resources)) {
    const type = (value as any)?.Type ?? 'Unknown';
    resourceTypes[type] = (resourceTypes[type] ?? 0) + 1;
  }

  const resourceCount = Object.keys(resources).length;
  const outputCount = Object.keys(outputs).length;

  return {
    resourceCount,
    resourceLimit: CFN_LIMITS.resources,
    resourcePercent: round((resourceCount / CFN_LIMITS.resources) * 100),
    outputCount,
    outputLimit: CFN_LIMITS.outputs,
    outputPercent: round((outputCount / CFN_LIMITS.outputs) * 100),
    templateBytes,
    templateLimit: CFN_LIMITS.templateBytes,
    templatePercent: round((templateBytes / CFN_LIMITS.templateBytes) * 100),
    resourceTypes,
  };
}

/**
 * Check stats against 80% warning thresholds. Returns warnings (if any).
 */
export function checkThresholds(stats: TemplateStats): StatsWarning[] {
  const warnings: StatsWarning[] = [];
  const threshold = WARNING_THRESHOLD * 100;

  if (stats.resourcePercent >= threshold) {
    warnings.push({
      message: `Resource count (${stats.resourceCount}/${stats.resourceLimit}) is at ${stats.resourcePercent}% of the CloudFormation limit`,
      current: stats.resourceCount,
      limit: stats.resourceLimit,
      percent: stats.resourcePercent,
    });
  }

  if (stats.outputPercent >= threshold) {
    warnings.push({
      message: `Output count (${stats.outputCount}/${stats.outputLimit}) is at ${stats.outputPercent}% of the CloudFormation limit`,
      current: stats.outputCount,
      limit: stats.outputLimit,
      percent: stats.outputPercent,
    });
  }

  if (stats.templatePercent >= threshold) {
    warnings.push({
      message: `Template size (${formatBytes(stats.templateBytes)}/${formatBytes(stats.templateLimit)}) is at ${stats.templatePercent}% of the CloudFormation limit`,
      current: stats.templateBytes,
      limit: stats.templateLimit,
      percent: stats.templatePercent,
    });
  }

  return warnings;
}

/**
 * Format stats as a human-readable report string.
 */
export function formatStatsReport(stats: TemplateStats): string {
  const lines: string[] = [
    'CloudFormation Template Statistics',
    '==================================',
    `Resources: ${stats.resourceCount}/${stats.resourceLimit} (${stats.resourcePercent}%)`,
    `Outputs:   ${stats.outputCount}/${stats.outputLimit} (${stats.outputPercent}%)`,
    `Size:      ${formatBytes(stats.templateBytes)}/${formatBytes(stats.templateLimit)} (${stats.templatePercent}%)`,
  ];

  const types = Object.entries(stats.resourceTypes).sort((a, b) => b[1] - a[1]);
  if (types.length > 0) {
    lines.push('', 'Resource Types:');
    for (const [type, count] of types) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  return lines.join('\n');
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
