#!/bin/bash
# test-local.sh - Quick local test using npm link (no Docker needed)
set -euo pipefail

echo "🧪 Testing cfn-include executable YAML (local npm link)..."

# Build first
echo "📦 Building..."
npm run build

# Link globally
echo "🔗 Linking package globally..."
npm link

# Verify commands exist
echo "✅ Verifying commands..."
which cfn || echo "❌ cfn not found"
which yml || echo "❌ yml not found"
which yaml || echo "❌ yaml not found"
which cfn-include || echo "❌ cfn-include not found"

# Create test directory
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo "📝 Creating test templates in $TEST_DIR..."

# Test 1: cfn shebang
cat > "$TEST_DIR/test-cfn.yaml" << 'EOF'
#!/usr/bin/env cfn
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-cfn-bucket
EOF
chmod +x "$TEST_DIR/test-cfn.yaml"

# Test 2: yml shebang
cat > "$TEST_DIR/test-yml.yaml" << 'EOF'
#!/usr/bin/env yml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-yml-bucket
EOF
chmod +x "$TEST_DIR/test-yml.yaml"

# Test 3: yaml shebang
cat > "$TEST_DIR/test-yaml.yaml" << 'EOF'
#!/usr/bin/env yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-yaml-bucket
EOF
chmod +x "$TEST_DIR/test-yaml.yaml"

# Run tests
echo ""
echo "🎯 Running tests..."
echo ""

for file in "$TEST_DIR"/test-*.yaml; do
  basename=$(basename "$file")
  echo "Testing: $basename"
  if "$file" | grep -q "test-.*-bucket"; then
    echo "  ✅ $basename works!"
  else
    echo "  ❌ $basename failed!"
    exit 1
  fi
done

echo ""
echo "✅ All local tests passed!"
echo ""
echo "To unlink: npm unlink -g @znemz/cfn-include"
