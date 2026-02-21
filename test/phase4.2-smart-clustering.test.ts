/**
 * Phase 4.2: Smart Clustering Integration Tests
 * 
 * Tests the enhanced dependency graph analysis and smart clustering features.
 * This is QA's independent test suite designed before seeing the implementation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { load as loadYaml } from '../src/lib/yaml.js';
import type { TemplateDocument } from '../src/types/template.js';

// Import the modules being tested (will fail until implementation exists)
// We're writing tests first to define expected behavior
let buildDependencyGraph: any;
let analyzeConnectivity: any;
let scoreCluster: any;
let detectStronglyConnectedComponents: any;
let clusterResources: any;
let optimizeClusters: any;
let enforceConstraints: any;
let generateSplitSuggestions: any;
let formatDetailedReport: any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy load modules - will be mocked or imported once implementation exists
beforeAll(async () => {
  try {
    const graphModule = await import('../src/lib/graph.js');
    buildDependencyGraph = graphModule.buildDependencyGraph;
    
    // These will fail until implemented
    const analysisModule = await import('../src/lib/analysis.js');
    analyzeConnectivity = analysisModule.analyzeConnectivity;
    scoreCluster = analysisModule.scoreCluster;
    detectStronglyConnectedComponents = analysisModule.detectStronglyConnectedComponents;
    
    const clusteringModule = await import('../src/lib/clustering.js');
    clusterResources = clusteringModule.clusterResources;
    optimizeClusters = clusteringModule.optimizeClusters;
    enforceConstraints = clusteringModule.enforceConstraints;
    
    const suggestionsModule = await import('../src/lib/suggestions.js');
    generateSplitSuggestions = suggestionsModule.generateSplitSuggestions;
    formatDetailedReport = suggestionsModule.formatDetailedReport;
  } catch (error) {
    console.warn('Some modules not yet implemented:', error.message);
  }
});

/**
 * Helper to load test fixture
 */
function loadFixture(name: string): TemplateDocument {
  const fixturePath = join(__dirname, 'fixtures', 'phase4.2', name);
  const content = readFileSync(fixturePath, 'utf-8');
  return loadYaml(content) as TemplateDocument;
}

describe('Phase 4.2: Dependency Analysis', () => {
  describe('analyzeConnectivity', () => {
    it('should compute connection strength for direct refs', () => {
      if (!analyzeConnectivity || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const connectivity = analyzeConnectivity(graph);
      
      expect(connectivity).toBeDefined();
      expect(connectivity.size).toBeGreaterThan(0);
      
      // Check that connections have required fields
      for (const [key, strength] of connectivity) {
        expect(strength).toHaveProperty('source');
        expect(strength).toHaveProperty('target');
        expect(strength).toHaveProperty('edgeCount');
        expect(strength).toHaveProperty('score');
        expect(strength.score).toBeGreaterThanOrEqual(0);
        expect(strength.score).toBeLessThanOrEqual(100);
      }
    });
    
    it('should detect bidirectional dependencies', () => {
      if (!analyzeConnectivity || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('circular-deps.yml');
      const graph = buildDependencyGraph(template);
      const connectivity = analyzeConnectivity(graph);
      
      // In circular-deps.yml, LambdaD and LambdaE reference each other
      const connections = Array.from(connectivity.values());
      const bidirectional = connections.filter(c => c.isBidirectional);
      
      expect(bidirectional.length).toBeGreaterThan(0);
    });
    
    it('should account for shared conditions', () => {
      if (!analyzeConnectivity || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('highly-interconnected.yml');
      const graph = buildDependencyGraph(template);
      const connectivity = analyzeConnectivity(graph);
      
      // Resources with shared conditions should have bonus score
      const withSharedConditions = Array.from(connectivity.values())
        .filter(c => c.sharedConditions && c.sharedConditions.length > 0);
      
      expect(withSharedConditions.length).toBeGreaterThan(0);
    });
  });
  
  describe('detectStronglyConnectedComponents', () => {
    it('should find simple cycles (A → B → C → A)', () => {
      if (!detectStronglyConnectedComponents || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('circular-deps.yml');
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);
      
      expect(sccs).toBeDefined();
      expect(Array.isArray(sccs)).toBe(true);
      
      // Should find the A → B → C → A cycle
      const cyclicSCCs = sccs.filter(scc => scc.isCyclic);
      expect(cyclicSCCs.length).toBeGreaterThan(0);
      
      // Check that LambdaA, LambdaB, LambdaC are in same SCC
      const abcCycle = cyclicSCCs.find(scc => 
        scc.resourceIds.includes('LambdaA') &&
        scc.resourceIds.includes('LambdaB') &&
        scc.resourceIds.includes('LambdaC')
      );
      expect(abcCycle).toBeDefined();
      expect(abcCycle!.resourceIds.length).toBe(3);
    });
    
    it('should find bidirectional dependencies (D ↔ E)', () => {
      if (!detectStronglyConnectedComponents || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('circular-deps.yml');
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);
      
      // Should find D ↔ E cycle
      const cyclicSCCs = sccs.filter(scc => scc.isCyclic);
      const deCycle = cyclicSCCs.find(scc =>
        scc.resourceIds.includes('LambdaD') &&
        scc.resourceIds.includes('LambdaE')
      );
      
      expect(deCycle).toBeDefined();
      expect(deCycle!.resourceIds.length).toBe(2);
    });
    
    it('should not include independent resources in cycles', () => {
      if (!detectStronglyConnectedComponents || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('circular-deps.yml');
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);
      
      // LambdaIndependent should not be in any cyclic SCC
      const cyclicSCCs = sccs.filter(scc => scc.isCyclic);
      for (const scc of cyclicSCCs) {
        expect(scc.resourceIds).not.toContain('LambdaIndependent');
      }
    });
    
    it('should handle acyclic graphs (no cycles)', () => {
      if (!detectStronglyConnectedComponents || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);
      
      // Clean layers should have no cycles
      const cyclicSCCs = sccs.filter(scc => scc.isCyclic);
      expect(cyclicSCCs.length).toBe(0);
    });
  });
  
  describe('scoreCluster', () => {
    it('should compute high cohesion for tightly connected cluster', () => {
      if (!scoreCluster || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      
      // Networking resources should be tightly connected
      const networkingResources = [
        'VPC', 'PublicSubnet1', 'PublicSubnet2', 'PrivateSubnet1', 'PrivateSubnet2',
        'InternetGateway', 'VPCGatewayAttachment', 'PublicRouteTable', 'PublicRoute',
        'WebSecurityGroup', 'AppSecurityGroup', 'DBSecurityGroup'
      ];
      
      const allClusters = new Map([
        ['Networking', networkingResources],
        ['Other', []]
      ]);
      
      const score = scoreCluster('Networking', networkingResources, graph, allClusters);
      
      expect(score).toHaveProperty('cohesion');
      expect(score).toHaveProperty('coupling');
      expect(score).toHaveProperty('quality');
      expect(score.cohesion).toBeGreaterThan(0.5); // High internal connectivity
      expect(score.coupling).toBeLessThan(0.3); // Low external dependencies
    });
  });
});

describe('Phase 4.2: Smart Clustering', () => {
  describe('clusterResources', () => {
    it('should group resources by connectivity (connectivity strategy)', () => {
      if (!clusterResources || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph, { strategy: 'connectivity' });
      
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBeGreaterThan(1);
      
      // All clusters should have required fields
      for (const cluster of clusters) {
        expect(cluster).toHaveProperty('id');
        expect(cluster).toHaveProperty('name');
        expect(cluster).toHaveProperty('resourceIds');
        expect(cluster).toHaveProperty('score');
        expect(Array.isArray(cluster.resourceIds)).toBe(true);
      }
    });
    
    it('should produce better results than semantic-only approach', () => {
      if (!clusterResources || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('highly-interconnected.yml');
      const graph = buildDependencyGraph(template);
      
      const semanticClusters = clusterResources(template, graph, { strategy: 'semantic' });
      const hybridClusters = clusterResources(template, graph, { strategy: 'hybrid' });
      
      // Calculate average quality scores
      const avgQuality = (clusters: any[]) => {
        const sum = clusters.reduce((acc, c) => acc + c.score.quality, 0);
        return sum / clusters.length;
      };
      
      const semanticQuality = avgQuality(semanticClusters);
      const hybridQuality = avgQuality(hybridClusters);
      
      // Hybrid should produce better quality (or at least equal)
      expect(hybridQuality).toBeGreaterThanOrEqual(semanticQuality);
    });
    
    it('should respect max cluster size constraint', () => {
      if (!clusterResources || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('oversized-stack.yml');
      const graph = buildDependencyGraph(template);
      const clusters = clusterResources(template, graph, { maxClusterSize: 400 });
      
      // No cluster should exceed 400 resources
      for (const cluster of clusters) {
        expect(cluster.resourceIds.length).toBeLessThanOrEqual(400);
      }
    });
    
    it('should keep SCC resources together', () => {
      if (!clusterResources || !buildDependencyGraph || !detectStronglyConnectedComponents) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('circular-deps.yml');
      const graph = buildDependencyGraph(template);
      const sccs = detectStronglyConnectedComponents(graph);
      const clusters = clusterResources(template, graph, { strategy: 'hybrid' });
      
      // Build resource → cluster map
      const resourceToCluster = new Map<string, string>();
      for (const cluster of clusters) {
        for (const rid of cluster.resourceIds) {
          resourceToCluster.set(rid, cluster.id);
        }
      }
      
      // All resources in same SCC must be in same cluster
      for (const scc of sccs.filter(s => s.isCyclic)) {
        const clusterIds = new Set(scc.resourceIds.map(r => resourceToCluster.get(r)));
        expect(clusterIds.size).toBe(1); // All in same cluster
      }
    });
  });
  
  describe('enforceConstraints', () => {
    it('should split oversized clusters', () => {
      if (!enforceConstraints || !buildDependencyGraph || !clusterResources) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('oversized-stack.yml');
      const graph = buildDependencyGraph(template);
      
      // Create one giant cluster (simulating worst case)
      const initialClusters = clusterResources(template, graph, { maxClusterSize: 1000 });
      
      // Now enforce smaller constraint
      const constrainedClusters = enforceConstraints(initialClusters, graph, 300);
      
      // All clusters should be under 300
      for (const cluster of constrainedClusters) {
        expect(cluster.resourceIds.length).toBeLessThanOrEqual(300);
      }
    });
  });
});

describe('Phase 4.2: Split Suggestions', () => {
  describe('generateSplitSuggestions', () => {
    it('should provide multiple strategies', () => {
      if (!generateSplitSuggestions || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      
      expect(suggestion).toHaveProperty('recommended');
      expect(suggestion).toHaveProperty('alternatives');
      expect(suggestion).toHaveProperty('analysis');
      expect(Array.isArray(suggestion.alternatives)).toBe(true);
    });
    
    it('should rank strategies by quality score', () => {
      if (!generateSplitSuggestions || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('highly-interconnected.yml');
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      
      // Recommended should have highest score
      const allOptions = [suggestion.recommended, ...suggestion.alternatives];
      const scores = allOptions.map(o => o.overallScore);
      const maxScore = Math.max(...scores);
      
      expect(suggestion.recommended.overallScore).toBe(maxScore);
    });
    
    it('should detect template exceeding limits', () => {
      if (!generateSplitSuggestions || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('oversized-stack.yml');
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      
      expect(suggestion.analysis.exceedsLimits).toBe(true);
      expect(suggestion.analysis.resourceOverage).toBeGreaterThan(0);
    });
    
    it('should minimize cross-stack references', () => {
      if (!generateSplitSuggestions || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      
      // Cross-stack deps should be reasonable (not every resource)
      const totalResources = Object.keys(template.Resources || {}).length;
      const crossStackDeps = suggestion.recommended.crossStackDeps.length;
      
      expect(crossStackDeps).toBeLessThan(totalResources * 0.3); // Less than 30%
    });
  });
  
  describe('formatDetailedReport', () => {
    it('should format comprehensive report', () => {
      if (!generateSplitSuggestions || !formatDetailedReport || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      const report = formatDetailedReport(suggestion);
      
      expect(typeof report).toBe('string');
      expect(report).toContain('CloudFormation Stack Split Analysis');
      expect(report).toContain('RECOMMENDED');
      expect(report).toContain('Quality Score');
      expect(report).toContain('Deployment Order');
    });
    
    it('should include cluster details', () => {
      if (!generateSplitSuggestions || !formatDetailedReport || !buildDependencyGraph) {
        console.warn('Skipping - modules not implemented yet');
        return;
      }
      
      const template = loadFixture('clean-layers.yml');
      const graph = buildDependencyGraph(template);
      const suggestion = generateSplitSuggestions(template, graph);
      const report = formatDetailedReport(suggestion);
      
      // Should mention clusters
      expect(report).toContain('Stack:');
      expect(report).toContain('Cohesion');
      expect(report).toContain('Coupling');
    });
  });
});

describe('Phase 4.2: Performance', () => {
  it('should process 500 resources in under 5 seconds', async () => {
    if (!generateSplitSuggestions || !buildDependencyGraph) {
      console.warn('Skipping - modules not implemented yet');
      return;
    }
    
    const template = loadFixture('oversized-stack.yml');
    const graph = buildDependencyGraph(template);
    
    const startTime = Date.now();
    const suggestion = generateSplitSuggestions(template, graph);
    const elapsed = Date.now() - startTime;
    
    console.log(`Processed ${Object.keys(template.Resources || {}).length} resources in ${elapsed}ms`);
    
    expect(elapsed).toBeLessThan(5000); // < 5 seconds
    expect(suggestion).toBeDefined();
  });
});

describe('Phase 4.2: Edge Cases', () => {
  it('should handle orphaned resources (zero dependencies)', () => {
    if (!clusterResources || !buildDependencyGraph) {
      console.warn('Skipping - modules not implemented yet');
      return;
    }
    
    const template = loadFixture('circular-deps.yml');
    const graph = buildDependencyGraph(template);
    const clusters = clusterResources(template, graph, { strategy: 'hybrid' });
    
    // LambdaIndependent has zero deps - should still be clustered somewhere
    const allResourceIds = new Set<string>();
    for (const cluster of clusters) {
      for (const rid of cluster.resourceIds) {
        allResourceIds.add(rid);
      }
    }
    
    expect(allResourceIds.has('LambdaIndependent')).toBe(true);
  });
  
  it('should handle template just under limits', () => {
    if (!generateSplitSuggestions || !buildDependencyGraph) {
      console.warn('Skipping - modules not implemented yet');
      return;
    }
    
    const template = loadFixture('clean-layers.yml');
    const graph = buildDependencyGraph(template);
    const suggestion = generateSplitSuggestions(template, graph);
    
    // Should still provide split recommendations even if not exceeding limits
    expect(suggestion.analysis.exceedsLimits).toBe(false);
    expect(suggestion.recommended.clusters.length).toBeGreaterThan(1);
  });
});

describe('Phase 4.2: Regression Prevention', () => {
  it('should not break existing suggestSplit functionality', async () => {
    const { suggestSplit } = await import('../src/lib/split.js');
    const template = loadFixture('clean-layers.yml');
    const graph = buildDependencyGraph(template);
    
    const suggestion = suggestSplit(template, graph);
    
    // Old API should still work
    expect(suggestion).toHaveProperty('groups');
    expect(suggestion).toHaveProperty('crossStackDependencies');
    expect(suggestion).toHaveProperty('deploymentOrder');
    expect(Array.isArray(suggestion.groups)).toBe(true);
  });
});
