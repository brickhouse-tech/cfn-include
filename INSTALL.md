# Installation Guide — Executable YAML

## Quick Start

```bash
npm install -g @znemz/cfn-include
```

That's it! The `cfn`, `yml`, and `yaml` commands are now available globally.

## What Gets Installed

npm automatically creates symlinks in your PATH for:
- `cfn` → executable YAML wrapper
- `yml` → alias to cfn
- `yaml` → alias to cfn
- `cfn-include` → original CLI

## Verify Installation

```bash
which cfn yml yaml
# Should show paths like:
# /usr/local/bin/cfn
# /usr/local/bin/yml
# /usr/local/bin/yaml
```

## Make Your First Executable Template

```bash
# Create a template
cat > my-stack.yaml << 'TEMPLATE'
#!/usr/bin/env yaml
Resources:
  Bucket:
    Type: AWS::S3::Bucket
TEMPLATE

# Make it executable
chmod +x my-stack.yaml

# Run it!
./my-stack.yaml              # Preview
./my-stack.yaml --deploy     # Deploy to AWS
```

## Troubleshooting

### "command not found: cfn"

**Cause:** npm bin directory not in PATH

**Fix:**
```bash
# Find npm bin directory
npm bin -g
# Example output: /usr/local/bin

# Add to PATH (in ~/.zshrc or ~/.bashrc)
export PATH="$(npm bin -g):$PATH"
```

### "./my-stack.yaml: bad interpreter: /usr/bin/env: cfn: No such file or directory"

**Cause:** npm global install location not in PATH, or cfn not executable

**Fix:**
```bash
# Reinstall globally
npm install -g @znemz/cfn-include

# Verify cfn is executable
ls -la $(npm bin -g)/cfn

# Should show: lrwxr-xr-x ... /usr/local/bin/cfn -> ../lib/node_modules/@znemz/cfn-include/bin/cfn
```

### Windows Support

Shebang (`#!`) is Unix/Linux/macOS only. On Windows:

**Option 1: WSL (Recommended)**
```bash
# Install in WSL
npm install -g @znemz/cfn-include

# Executable YAML works normally
chmod +x template.yaml
./template.yaml --deploy
```

**Option 2: Direct CLI**
```bash
# Use cfn-include directly (no shebang)
cfn-include template.yaml --deploy
```

## Examples

See `examples/` directory:
- `executable-simple.yaml` — Basic S3 bucket
- `executable-template.yaml` — Full auto-scaling web stack

Both are ready to run:
```bash
cd examples
./executable-simple.yaml
```

## Uninstall

```bash
npm uninstall -g @znemz/cfn-include
```

This removes all bin symlinks automatically.
