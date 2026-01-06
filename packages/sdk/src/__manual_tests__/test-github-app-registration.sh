#!/bin/bash
# Test GitHub App Registration with Dummy Data
# This creates a test registration to verify the script works

set -e

echo "============================================================"
echo "GitHub App Registration - TEST MODE"
echo "============================================================"
echo ""
echo "⚠️  This will register a TEST GitHub App with dummy credentials"
echo "   You can run this to verify everything works before using real credentials"
echo ""

# Generate a test private key (RSA 2048-bit)
TEMP_KEY=$(mktemp)
openssl genrsa -out "$TEMP_KEY" 2048 2>/dev/null

echo "✅ Generated test RSA private key"
echo ""

# Load OAUTH_ENCRYPTION_KEY from .env
OAUTH_ENCRYPTION_KEY=$(grep "^OAUTH_ENCRYPTION_KEY=" ../../.env | cut -d'=' -f2-)

if [ -z "$OAUTH_ENCRYPTION_KEY" ]; then
  echo "❌ OAUTH_ENCRYPTION_KEY not found in .env file"
  exit 1
fi

echo "✅ Found OAUTH_ENCRYPTION_KEY"
echo ""

# Set test environment variables
export DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public"
export OAUTH_ENCRYPTION_KEY="$OAUTH_ENCRYPTION_KEY"
export GITHUB_APP_ID="999999"
export GITHUB_CLIENT_ID="Iv1.test123456789"
export GITHUB_CLIENT_SECRET="ghp_testClientSecretForDevFlow123456789"
export GITHUB_PRIVATE_KEY="$(cat $TEMP_KEY)"
export GITHUB_WEBHOOK_SECRET="test_webhook_secret_$(openssl rand -hex 16)"
export GITHUB_APP_NAME="DevFlow Test App"
export GITHUB_APP_SLUG="devflow-test"
export PROJECT_ID=""

echo "Test Credentials:"
echo "  App ID: $GITHUB_APP_ID"
echo "  Client ID: $GITHUB_CLIENT_ID"
echo "  App Name: $GITHUB_APP_NAME"
echo "  App Slug: $GITHUB_APP_SLUG"
echo "  Project: Global (all projects)"
echo ""
echo "Running registration..."
echo ""

# Run the registration script
npx ts-node src/__manual_tests__/register-github-app-env.ts

# Cleanup
rm -f "$TEMP_KEY"

echo ""
echo "============================================================"
echo "✅ Test registration completed successfully!"
echo "============================================================"
echo ""
echo "To register a REAL GitHub App:"
echo "1. Create your app at: https://github.com/settings/apps/new"
echo "2. Download the private key (.pem file)"
echo "3. Run:"
echo ""
echo "  GITHUB_APP_ID=\"your-app-id\" \\"
echo "  GITHUB_CLIENT_ID=\"Iv1.your-client-id\" \\"
echo "  GITHUB_CLIENT_SECRET=\"your-client-secret\" \\"
echo "  GITHUB_PRIVATE_KEY_PATH=\"/path/to/private-key.pem\" \\"
echo "  GITHUB_WEBHOOK_SECRET=\"your-webhook-secret\" \\"
echo "  GITHUB_APP_NAME=\"DevFlow\" \\"
echo "  GITHUB_APP_SLUG=\"devflow\" \\"
echo "  PROJECT_ID=\"\" \\"
echo "  ./src/__manual_tests__/register-github-app-simple.sh"
echo ""
