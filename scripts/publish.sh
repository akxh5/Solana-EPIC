#!/bin/bash
set -euo pipefail

RESUME_FROM=""
if [[ $# -gt 0 ]]; then
  if [[ "$1" == "--from" ]] && [[ $# -gt 1 ]]; then
    RESUME_FROM="$2"
  else
    RESUME_FROM="$1"
  fi
fi

PACKAGES=(
  "cli-darwin-arm64"
  "cli-darwin-x64"
  "cli-linux-x64"
  "cli-win32-x64"
  "parser"
  "diff-engine"
  "cli"
  "github-action"
)

TOTAL=${#PACKAGES[@]}
FOUND_START=0
if [[ -z "$RESUME_FROM" ]]; then
  FOUND_START=1
fi

publish() {
  local pkg_name=$1
  local index=$2
  
  echo "=================================================="
  echo "Publishing @solana-epic/${pkg_name} (${index}/${TOTAL})"
  echo "If npm requests an OTP, enter it below."
  echo "=================================================="
  
  cd "packages/${pkg_name}"
  
  if ! npm publish --access public --tag beta; then
    echo "❌ Failed to publish @solana-epic/${pkg_name}"
    exit 1
  fi
  
  cd - > /dev/null
  
  local pkg_version=$(node -p "require('./package.json').version")
  echo "✓ Published @solana-epic/${pkg_name}@${pkg_version}"
  
  local version
  # npm view might take a moment to sync on public registry, but we check immediately as requested
  if ! version=$(npm view "@solana-epic/${pkg_name}" version 2>/dev/null); then
    echo "⚠️  Could not immediately fetch version from registry, but publish succeeded locally."
  else
    echo "Detected version on registry: ${version}"
  fi
  echo ""
}

echo "Starting EPIC package publication sequence..."

for i in "${!PACKAGES[@]}"; do
  pkg="${PACKAGES[$i]}"
  
  if [[ "$FOUND_START" -eq 0 ]]; then
    if [[ "$pkg" == "$RESUME_FROM" ]]; then
      FOUND_START=1
    else
      echo "Skipping ${pkg}..."
      continue
    fi
  fi
  
  publish "$pkg" "$((i+1))"
done

if [[ "$FOUND_START" -eq 0 ]]; then
  echo "❌ Error: Resume package '${RESUME_FROM}' not found in package list."
  exit 1
fi

echo "=================================================="
echo "Publication Complete. Finalizing Verification..."
echo "=================================================="
echo "CLI Dist Tags:"
npm dist-tag ls @solana-epic/cli
echo "CLI Registry Version:"
npm view @solana-epic/cli version
echo ""
pkg_version=$(node -p "require('./package.json').version")
echo "All packages published successfully! EPIC v${pkg_version} is now live."
