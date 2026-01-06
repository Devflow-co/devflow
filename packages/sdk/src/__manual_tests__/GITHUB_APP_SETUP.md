# GitHub App Registration Guide

This guide explains how to create and register a GitHub App in DevFlow.

## Step 1: Create GitHub App

1. Go to: https://github.com/settings/apps/new

2. Fill in the required fields:

   **Basic Information:**
   - **GitHub App name**: `DevFlow` (or your organization name)
   - **Homepage URL**: `https://your-domain.com`
   - **User authorization callback URL**: `https://api.your-domain.com/api/v1/auth/github-app/callback`
   - **Setup URL**: `https://api.your-domain.com/api/v1/auth/github-app/callback`

   **Webhook:**
   - **Webhook URL**: `https://api.your-domain.com/api/v1/webhooks/github-app`
   - **Webhook secret**: Generate a random string (e.g., `openssl rand -hex 32`)

   **Permissions:**
   - Repository contents: **Read & Write**
   - Pull requests: **Read & Write**
   - Issues: **Read & Write**
   - Metadata: **Read-only** (automatically selected)

   **Events:**
   - ✅ Installation
   - ✅ Installation repositories
   - ✅ Pull request
   - ✅ Push

   **Where can this GitHub App be installed?**
   - Select **Any account** (or **Only on this account** for private use)

3. Click **Create GitHub App**

4. After creation:
   - Note the **App ID** (shown at the top)
   - Note the **Client ID** (shown in the OAuth section)
   - Click **Generate a new client secret** and save it
   - Click **Generate a private key** and download the `.pem` file

## Step 2: Register in DevFlow

You have two options for registering the GitHub App in DevFlow:

### Option A: Interactive Script (Recommended)

```bash
cd /Users/victorgambert/Sites/Devflow/packages/sdk

DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
OAUTH_ENCRYPTION_KEY="your-encryption-key" \
npx ts-node src/__manual_tests__/register-github-app.ts
```

The script will prompt you for:
- App ID
- Client ID
- Client Secret
- Private Key (paste the content of the `.pem` file)
- Webhook Secret
- App Name (e.g., "DevFlow")
- App Slug (e.g., "devflow" - must match the URL slug from GitHub)
- Project ID (optional - leave empty for global config)

### Option B: Environment Variables

```bash
cd /Users/victorgambert/Sites/Devflow/packages/sdk

DATABASE_URL="postgresql://devflow:changeme@localhost:5432/devflow?schema=public" \
OAUTH_ENCRYPTION_KEY="your-encryption-key" \
GITHUB_APP_ID="123456" \
GITHUB_CLIENT_ID="Iv1.abc123def456" \
GITHUB_CLIENT_SECRET="ghp_abc123def456..." \
GITHUB_PRIVATE_KEY="$(cat path/to/downloaded-private-key.pem)" \
GITHUB_WEBHOOK_SECRET="your-webhook-secret" \
GITHUB_APP_NAME="DevFlow" \
GITHUB_APP_SLUG="devflow" \
PROJECT_ID="" \
npx ts-node src/__manual_tests__/register-github-app-env.ts
```

**Note:** Leave `PROJECT_ID` empty for global configuration (works for all projects).

## Step 3: Verify Installation URLs

After registration, verify your GitHub App settings:

1. Go to: https://github.com/settings/apps/YOUR_APP_SLUG

2. Verify URLs:
   - **Callback URL**: `https://api.your-domain.com/api/v1/auth/github-app/callback`
   - **Webhook URL**: `https://api.your-domain.com/api/v1/webhooks/github-app`

3. For local development, you can use ngrok:
   ```bash
   ngrok http 3000
   ```
   Then update the URLs to use your ngrok URL (e.g., `https://abc123.ngrok.io/api/v1/auth/github-app/callback`)

## Step 4: Test the Installation

1. Start your DevFlow services:
   ```bash
   docker-compose up -d
   pnpm --filter @devflow/api dev
   pnpm --filter @devflow/web dev
   ```

2. Open DevFlow in your browser: http://localhost:3001

3. Navigate to your project settings

4. Go to the **Integrations** tab

5. Find the **GitHub App (Granular Access)** section

6. Click **Install GitHub App**

7. You'll be redirected to GitHub to select repositories/organizations

8. After authorization, you'll be redirected back to DevFlow

9. Use the repository selector to modify your selection

## Troubleshooting

### "Invalid state parameter"
- The state token expired (10 minutes timeout)
- Try the installation again

### "Invalid webhook signature"
- Webhook secret mismatch
- Re-register the GitHub App with the correct webhook secret

### "Installation not found"
- The callback didn't complete successfully
- Check API logs for errors
- Verify the callback URL is correct

### Private Key Format
The private key must be in PEM format and include the full content:
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----
```

## Security Notes

- The `OAUTH_ENCRYPTION_KEY` must be a base64-encoded 32-byte key
- All sensitive fields (client secret, private key, webhook secret) are encrypted in the database
- Never commit private keys or secrets to version control
- Rotate credentials regularly
- Use different GitHub Apps for development and production environments

## Additional Resources

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps)
- [GitHub App Permissions](https://docs.github.com/en/developers/apps/building-github-apps/setting-permissions-for-github-apps)
- [GitHub Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
