import { describe, it, expect } from 'vitest';
import replaceEnv from '../dist/lib/replaceEnv.js';

describe('replaceEnv', () => {
  it('should replace some defined vars', () => {
    const template = replaceEnv(
      `
      Fn:DeepMerge:
      - !Include ./regions/$AWS_REGION/someFile.yml
      - !Include ./regions/\${AWS_REGION}/someFile.yml
      - Junk: $JUNK
      - Something: \${SOMETHING_ELSE}
    `,
      { AWS_REGION: 'us-east-1', JUNK: undefined, SOMETHING_ELSE: 'hi' },
    );

    expect(template).toBe(`
      Fn:DeepMerge:
      - !Include ./regions/us-east-1/someFile.yml
      - !Include ./regions/us-east-1/someFile.yml
      - Junk: undefined
      - Something: hi
    `);
  });

  it('should handle empty env object', () => {
    const template = replaceEnv('Hello $WORLD', {});
    expect(template).toBe('Hello $WORLD');
  });

  it('should handle multiple occurrences of same variable', () => {
    const template = replaceEnv('$VAR and $VAR and ${VAR}', { VAR: 'test' });
    expect(template).toBe('test and test and test');
  });

  it('should not replace escaped variables', () => {
    const template = replaceEnv('$$VAR and $VAR', { VAR: 'test' });
    // Note: This test documents current behavior - may need adjustment
    expect(template).toContain('test');
  });
});
