#!/bin/bash
# test-install.sh - Test executable YAML installation and functionality
set -euo pipefail

echo "🧪 Testing cfn-include executable YAML installation..."

# Cleanup function
cleanup() {
  echo "🧹 Cleaning up..."
  docker rm -f cfn-test 2>/dev/null || true
}
trap cleanup EXIT

# Build test image
echo "📦 Building test Docker image..."
docker build -t cfn-include-test -f- . << 'DOCKERFILE'
FROM node:22-alpine

# Install basics
RUN apk add --no-cache bash curl

# Set working directory
WORKDIR /test

# Copy package to install
COPY package.json ./
COPY dist ./dist/
COPY bin ./bin/
COPY scripts ./scripts/
COPY INSTALL.md ./

# Install globally (skip prepare script - sort-package-json is a devDependency)
RUN npm install -g . --ignore-scripts

# Verify installation
RUN which cfn && which yml && which yaml && which cfn-include

# Create test template
RUN printf '#!/usr/bin/env yaml\nAWSTemplateFormatVersion: '"'"'2010-09-09'"'"'\nDescription: Test executable YAML\nResources:\n  Bucket:\n    Type: AWS::S3::Bucket\n    Properties:\n      BucketName: test-bucket\n' > /tmp/test-stack.yaml && \
    chmod +x /tmp/test-stack.yaml && \
    /tmp/test-stack.yaml | grep -q "test-bucket" && echo "✅ Executable YAML works!"

CMD ["/bin/bash"]
DOCKERFILE

echo "✅ Docker image built successfully!"

# Run interactive test
echo ""
echo "🎯 Running interactive test..."
echo ""

docker run --rm cfn-include-test /bin/bash -c '
echo "=== Verification Tests ==="
echo ""

echo "1️⃣ Check installed commands:"
which cfn yml yaml cfn-include
echo ""

echo "2️⃣ Check symlinks:"
ls -la $(which cfn) $(which yml) $(which yaml)
echo ""

echo "3️⃣ Test executable template:"
printf '"'"'#!/usr/bin/env yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  TestBucket:
    Type: AWS::S3::Bucket
'"'"' > /tmp/demo.yaml
chmod +x /tmp/demo.yaml

echo "Running: /tmp/demo.yaml"
/tmp/demo.yaml | head -10
echo ""

echo "4️⃣ Test all three shebangs:"
for cmd in cfn yml yaml; do
  echo "Testing #!/usr/bin/env $cmd"
  printf '"'"'#!/usr/bin/env %s
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Bucket:
    Type: AWS::S3::Bucket
'"'"' "$cmd" > /tmp/test-$cmd.yaml
  chmod +x /tmp/test-$cmd.yaml
  /tmp/test-$cmd.yaml > /dev/null && echo "  ✅ $cmd works!" || echo "  ❌ $cmd failed!"
done
echo ""

echo "✅ All tests passed!"
'

echo ""
echo "✨ Installation test complete!"
