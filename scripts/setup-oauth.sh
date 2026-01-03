#!/bin/bash

# DevFlow OAuth Setup Script
# This script helps set up OAuth credentials for all providers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"

echo "🚀 DevFlow OAuth Setup"
echo "====================="
echo ""

# Check if .env exists, if not create from .env.example
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 Creating .env file from .env.example..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo "✅ Created .env file"
else
    echo "✅ Found existing .env file"
fi

echo ""

# Function to check if a variable is set in .env
check_env_var() {
    local var_name=$1
    local value=$(grep "^${var_name}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$value" ] || [ "$value" = "" ]; then
        return 1
    else
        return 0
    fi
}

# Function to set environment variable in .env
set_env_var() {
    local var_name=$1
    local var_value=$2

    # Check if variable exists
    if grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
        # Update existing variable (BSD sed compatible)
        sed -i.bak "s|^${var_name}=.*|${var_name}=${var_value}|" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak"
    else
        # Add new variable
        echo "${var_name}=${var_value}" >> "$ENV_FILE"
    fi
}

# Generate OAUTH_ENCRYPTION_KEY if missing
echo "🔐 Checking OAuth Encryption Key..."
if ! check_env_var "OAUTH_ENCRYPTION_KEY"; then
    echo "⚠️  OAUTH_ENCRYPTION_KEY not found, generating..."
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    set_env_var "OAUTH_ENCRYPTION_KEY" "$ENCRYPTION_KEY"
    echo "✅ Generated and saved OAUTH_ENCRYPTION_KEY"
else
    echo "✅ OAUTH_ENCRYPTION_KEY already configured"
fi

echo ""

# Check OAuth credentials for each provider
echo "📋 Checking OAuth Credentials:"
echo "================================"
echo ""

# Linear
echo "🔵 Linear OAuth:"
if check_env_var "LINEAR_APP_CLIENT_ID" && check_env_var "LINEAR_APP_CLIENT_SECRET"; then
    echo "   ✅ Configured"
else
    echo "   ❌ Not configured"
    echo "   📖 Setup guide:"
    echo "      1. Go to: https://linear.app/settings/api/applications"
    echo "      2. Click 'Create New Application'"
    echo "      3. Name: DevFlow"
    echo "      4. Callback URL: http://localhost:3001/api/v1/auth/linear/callback"
    echo "      5. Scopes: read, write, issues:create, comments:create"
    echo "      6. Copy Client ID and Secret to .env:"
    echo "         LINEAR_APP_CLIENT_ID=your_client_id"
    echo "         LINEAR_APP_CLIENT_SECRET=your_client_secret"
fi
echo ""

# GitHub
echo "🐙 GitHub OAuth:"
if check_env_var "GITHUB_APP_CLIENT_ID" && check_env_var "GITHUB_APP_CLIENT_SECRET"; then
    echo "   ✅ Configured"
else
    echo "   ❌ Not configured"
    echo "   📖 Setup guide:"
    echo "      1. Go to: https://github.com/settings/developers"
    echo "      2. Click 'New OAuth App'"
    echo "      3. Application name: DevFlow"
    echo "      4. Homepage URL: http://localhost:3001"
    echo "      5. Callback URL: http://localhost:3001/api/v1/auth/github/callback"
    echo "      6. Copy Client ID and Secret to .env:"
    echo "         GITHUB_APP_CLIENT_ID=your_client_id"
    echo "         GITHUB_APP_CLIENT_SECRET=your_client_secret"
fi
echo ""

# Figma
echo "🎨 Figma OAuth (Optional):"
if check_env_var "FIGMA_APP_CLIENT_ID" && check_env_var "FIGMA_APP_CLIENT_SECRET"; then
    echo "   ✅ Configured"
else
    echo "   ⏭️  Not configured (optional)"
    echo "   📖 Setup guide:"
    echo "      1. Go to: https://www.figma.com/developers/apps"
    echo "      2. Click 'Create new app'"
    echo "      3. App name: DevFlow"
    echo "      4. Callback URL: http://localhost:3001/api/v1/auth/figma/callback"
    echo "      5. Copy credentials to .env:"
    echo "         FIGMA_APP_CLIENT_ID=your_client_id"
    echo "         FIGMA_APP_CLIENT_SECRET=your_client_secret"
fi
echo ""

# Sentry
echo "🔴 Sentry OAuth (Optional):"
if check_env_var "SENTRY_APP_CLIENT_ID" && check_env_var "SENTRY_APP_CLIENT_SECRET"; then
    echo "   ✅ Configured"
else
    echo "   ⏭️  Not configured (optional)"
    echo "   📖 Setup guide:"
    echo "      1. Go to: https://sentry.io/settings/account/api/applications/"
    echo "      2. Click 'Create New Application'"
    echo "      3. Name: DevFlow"
    echo "      4. Redirect URL: http://localhost:3001/api/v1/auth/sentry/callback"
    echo "      5. Scopes: project:read, event:read, org:read"
    echo "      6. Copy credentials to .env:"
    echo "         SENTRY_APP_CLIENT_ID=your_client_id"
    echo "         SENTRY_APP_CLIENT_SECRET=your_client_secret"
fi
echo ""

echo "================================"
echo ""

# Count configured providers
configured=0
[ "$(check_env_var LINEAR_APP_CLIENT_ID && check_env_var LINEAR_APP_CLIENT_SECRET && echo 1)" = "1" ] && ((configured++))
[ "$(check_env_var GITHUB_APP_CLIENT_ID && check_env_var GITHUB_APP_CLIENT_SECRET && echo 1)" = "1" ] && ((configured++))
[ "$(check_env_var FIGMA_APP_CLIENT_ID && check_env_var FIGMA_APP_CLIENT_SECRET && echo 1)" = "1" ] && ((configured++))
[ "$(check_env_var SENTRY_APP_CLIENT_ID && check_env_var SENTRY_APP_CLIENT_SECRET && echo 1)" = "1" ] && ((configured++))

echo "📊 Summary: $configured/4 providers configured"
echo ""

if [ $configured -eq 0 ]; then
    echo "⚠️  No OAuth providers configured yet!"
    echo "   Please follow the setup guides above to configure at least one provider."
    echo ""
    echo "💡 Quick start: Configure Linear first (most commonly used)"
    exit 1
elif [ $configured -lt 2 ]; then
    echo "⚠️  Only $configured provider(s) configured."
    echo "   Consider configuring GitHub and Linear for full functionality."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OAuth credentials (see guides above)"
echo "2. Restart the API: pnpm --filter @devflow/api dev"
echo "3. Check logs for: '✓ Registered N system OAuth app(s)'"
echo "4. Test connections in the web UI"
echo ""
