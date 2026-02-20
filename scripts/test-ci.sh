#!/bin/bash
# test-ci.sh - CI-specific test that doesn't use npm link
set -euo pipefail

echo "🧪 Testing cfn-include executable YAML (CI mode)..."

# Verify bin scripts exist and are executable
echo "✅ Verifying bin scripts..."
test -x bin/cfn || { echo "❌ bin/cfn not executable"; exit 1; }
test -x bin/yml || { echo "❌ bin/yml not executable"; exit 1; }
test -x bin/yaml || { echo "❌ bin/yaml not executable"; exit 1; }

# Verify symlinks
echo "✅ Verifying symlinks..."
readlink bin/yml | grep -q "cfn" || { echo "❌ bin/yml symlink broken"; exit 1; }
readlink bin/yaml | grep -q "cfn" || { echo "❌ bin/yaml symlink broken"; exit 1; }

# Create test directory
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

echo "📝 Creating test templates in $TEST_DIR..."

# Test with each wrapper
for cmd in cfn yml yaml; do
  echo ""
  echo "Testing bin/$cmd..."
  
  cat > "$TEST_DIR/test-$cmd.yaml" << EOF
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: test-$cmd-bucket
EOF

  # Run the bin script directly
  if ./bin/$cmd "$TEST_DIR/test-$cmd.yaml" | grep -q "test-$cmd-bucket"; then
    echo "  ✅ bin/$cmd works!"
  else
    echo "  ❌ bin/$cmd failed!"
    exit 1
  fi
done

echo ""
echo "✅ All CI tests passed!"
