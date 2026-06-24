#!/bin/bash
set -e

echo "Starting EPIC package publication sequence..."

# 1. Publish native prebuilt binary targets
echo "Publishing @epic-security/cli-darwin-arm64..."
cd packages/cli-darwin-arm64
npm publish --access public --tag beta
cd ../..

echo "Publishing @epic-security/cli-darwin-x64..."
cd packages/cli-darwin-x64
npm publish --access public --tag beta
cd ../..

echo "Publishing @epic-security/cli-linux-x64..."
cd packages/cli-linux-x64
npm publish --access public --tag beta
cd ../..

echo "Publishing @epic-security/cli-win32-x64..."
cd packages/cli-win32-x64
npm publish --access public --tag beta
cd ../..

# 2. Publish shared libraries
echo "Publishing @epic-security/parser..."
cd packages/parser
npm publish --access public --tag beta
cd ../..

echo "Publishing @epic-security/diff-engine..."
cd packages/diff-engine
npm publish --access public --tag beta
cd ../..

# 3. Publish CLI binary loader
echo "Publishing @epic-security/cli..."
cd packages/cli
npm publish --access public --tag beta
cd ../..

# 4. Publish GitHub Action integration
echo "Publishing @epic-security/github-action..."
cd packages/github-action
npm publish --access public --tag beta
cd ../..

echo "All EPIC packages published successfully!"
