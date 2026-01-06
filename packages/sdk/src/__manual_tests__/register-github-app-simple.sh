#!/bin/bash
# Simple GitHub App Registration Script
# Usage: ./register-github-app-simple.sh

set -e

echo "============================================================"
echo "GitHub App Registration - Simple Version"
echo "============================================================"
echo ""

# Check if .env file exists in project root
if [ ! -f "../../.env" ]; then
  echo "❌ .env file not found at project root"
  echo "   Expected: /Users/victorgambert/Sites/Devflow/.env"
  exit 1
fi

# Load OAUTH_ENCRYPTION_KEY from .env
export OAUTH_ENCRYPTION_KEY=$(grep "^OAUTH_ENCRYPTION_KEY=" ../../.env | cut -d'=' -f2-)

if [ -z "$OAUTH_ENCRYPTION_KEY" ]; then
  echo "❌ OAUTH_ENCRYPTION_KEY not found in .env file"
  exit 1
fi

echo "✅ Found OAUTH_ENCRYPTION_KEY"
echo ""

# Check required environment variables
required_vars=(
  "GITHUB_APP_ID"
  "GITHUB_CLIENT_ID"
  "GITHUB_CLIENT_SECRET"
  "GITHUB_PRIVATE_KEY_PATH"
  "GITHUB_WEBHOOK_SECRET"
  "GITHUB_APP_NAME"
  "GITHUB_APP_SLUG"
)

missing=()
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing+=("$var")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Missing required environment variables:"
  for var in "${missing[@]}"; do
    echo "   - $var"
  done
  echo ""
  echo "Example usage:"
  echo ""
  echo "  GITHUB_APP_ID=\"123456\" \\"
  echo "  GITHUB_CLIENT_ID=\"Iv1.abc123\" \\"
  echo "  GITHUB_CLIENT_SECRET=\"secret123\" \\"
  echo "  GITHUB_PRIVATE_KEY_PATH=\"/path/to/private-key.pem\" \\"
  echo "  GITHUB_WEBHOOK_SECRET=\"webhook-secret\" \\"
  echo "  GITHUB_APP_NAME=\"DevFlow\" \\"
  echo "  GITHUB_APP_SLUG=\"devflow\" \\"
  echo "  PROJECT_ID=\"\" \\"
  echo "  ./register-github-app-simple.sh"
  echo ""
  exit 1
fi

# Read private key from file
if [ ! -f "$GITHUB_PRIVATE_KEY_PATH" ]; then
  echo "❌ Private key file not found: $GITHUB_PRIVATE_KEY_PATH"
  exit 1
fi

export GITHUB_PRIVATE_KEY=$(cat "$GITHUB_PRIVATE_KEY_PATH")
echo "✅ Loaded private key from: $GITHUB_PRIVATE_KEY_PATH"
echo ""

# Set DATABASE_URL
export DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public"

# Run the registration script
echo "Running registration script..."
echo ""

npx ts-node src/__manual_tests__/register-github-app-env.ts

echo ""
echo "Done!"
