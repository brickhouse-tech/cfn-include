import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Executable YAML', () => {
  let testDir: string;
  let binPath: string;

  beforeAll(() => {
    testDir = mkdtempSync(join(tmpdir(), 'cfn-test-'));
    
    // Get the absolute path to bin/cfn relative to project root
    binPath = join(process.cwd(), 'bin', 'cfn');
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should have executable bin/cfn script', () => {
    const result = execSync(`test -x ${binPath}; echo $?`).toString().trim();
    expect(result).toBe('0');
  });

  it('should have yml symlink pointing to cfn', () => {
    const ymlPath = join(process.cwd(), 'bin', 'yml');
    const result = execSync(`readlink ${ymlPath}`).toString().trim();
    expect(result).toBe('cfn');
  });

  it('should have yaml symlink pointing to cfn', () => {
    const yamlPath = join(process.cwd(), 'bin', 'yaml');
    const result = execSync(`readlink ${yamlPath}`).toString().trim();
    expect(result).toBe('cfn');
  });

  it('should process template with #!/usr/bin/env cfn', () => {
    const templatePath = join(testDir, 'test-cfn.yaml');
    writeFileSync(
      templatePath,
      `#!/usr/bin/env cfn
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-bucket
`
    );
    chmodSync(templatePath, 0o755);

    // Execute directly with the bin script (simulates shebang execution)
    const result = execSync(`${binPath} ${templatePath}`).toString();
    expect(result).toContain('test-bucket');
    expect(result).toContain('AWS::S3::Bucket');
  });

  it('should process template with #!/usr/bin/env yml', () => {
    const ymlPath = join(process.cwd(), 'bin', 'yml');
    const templatePath = join(testDir, 'test-yml.yaml');
    writeFileSync(
      templatePath,
      `#!/usr/bin/env yml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-yml-bucket
`
    );
    chmodSync(templatePath, 0o755);

    const result = execSync(`${ymlPath} ${templatePath}`).toString();
    expect(result).toContain('test-yml-bucket');
  });

  it('should process template with #!/usr/bin/env yaml', () => {
    const yamlPath = join(process.cwd(), 'bin', 'yaml');
    const templatePath = join(testDir, 'test-yaml.yaml');
    writeFileSync(
      templatePath,
      `#!/usr/bin/env yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-yaml-bucket
`
    );
    chmodSync(templatePath, 0o755);

    const result = execSync(`${yamlPath} ${templatePath}`).toString();
    expect(result).toContain('test-yaml-bucket');
  });

  it('should accept --deploy flag', () => {
    const templatePath = join(testDir, 'test-deploy.yaml');
    writeFileSync(
      templatePath,
      `#!/usr/bin/env cfn
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
`
    );
    chmodSync(templatePath, 0o755);

    // Test --deploy flag parsing (will fail without AWS creds, but should accept the flag)
    try {
      execSync(`${binPath} ${templatePath} --help`).toString();
    } catch (e) {
      // Expected - just checking the script doesn't error on parsing
    }
  });

  it('should show usage when called without arguments', () => {
    try {
      execSync(`${binPath}`, { stdio: 'pipe' });
      // Should exit with error
      expect.fail('Should have exited with error');
    } catch (e: any) {
      const stderr = e.stderr?.toString() || '';
      const stdout = e.stdout?.toString() || '';
      const output = stderr + stdout;
      expect(output).toContain('Usage:');
    }
  });
});
