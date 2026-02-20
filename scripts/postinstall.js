#!/usr/bin/env node
// Post-install message for executable YAML feature

const isGlobalInstall = process.env.npm_config_global === 'true';

if (isGlobalInstall) {
  console.log('\n✨ cfn-include installed successfully!\n');
  console.log('🔥 NEW: Executable YAML support is now available!\n');
  console.log('Three shebang options to choose from:');
  console.log('  #!/usr/bin/env cfn   (CloudFormation-specific)');
  console.log('  #!/usr/bin/env yml   (short & clean)');
  console.log('  #!/usr/bin/env yaml  (explicit)\n');
  console.log('Quick start:');
  console.log('  1. Add shebang to your template: #!/usr/bin/env yaml');
  console.log('  2. Make it executable: chmod +x template.yaml');
  console.log('  3. Run it: ./template.yaml --deploy\n');
  console.log('📚 Full guide: https://github.com/brickhouse-tech/cfn-include#executable-yaml\n');
}
