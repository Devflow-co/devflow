# Multi-Tenant OAuth Architecture

**Version:** 2.0
**Updated:** December 8, 2025
**Status:** Production Ready

## Overview

DevFlow supports multi-tenant OAuth, allowing each project/client to use their own OAuth applications. This is essential for SaaS deployments where different clients have separate workspaces (e.g., different Linear teams, GitHub organizations).

## Architecture

### Before: Single OAuth App (Phase 6)
```
All Projects → Same LINEAR_OAUTH_CLIENT_ID (.env) → Same Linear Workspace
```

**Problem:** All clients share the same Linear workspace. Not suitable for multi-tenant SaaS.

### After: Per-Project OAuth Apps (Phase 6.1)
```
Project A → Linear OAuth App #1 (DB) → Client A's Linear Workspace
Project B → Linear OAuth App #2 (DB) → Client B's Linear Workspace
Project C → Linear OAuth App #3 (DB) → Client C's Linear Workspace
```

**Benefits:**
- ✅ Each client has their own Linear workspace
- ✅ Isolated OAuth credentials per project
- ✅ CLIENT_SECRET encrypted in database
- ✅ Easy to onboard new clients
- ✅ Scalable for SaaS deployments

## Database Schema

### OAuthApplication Table

Stores per-project OAuth app credentials:

```prisma
model OAuthApplication {
  id             String   @id @default(cuid())
  projectId      String   @map("project_id")
  provider       OAuthProvider  // GITHUB | LINEAR

  // OAuth app credentials (encrypted)
  clientId       String   @map("client_id")
  clientSecret   String   @map("client_secret") @db.Text // Encrypted with AES-256-GCM
  encryptionIv   String   @map("encryption_iv")
  redirectUri    String   @map("redirect_uri")

  // OAuth flow type
  flowType       String   @map("flow_type") // device | authorization_code

  // Scopes
  scopes         String[] @default([])

  // App metadata
  name           String?  // User-friendly name
  description    String?

  // Status
  isActive       Boolean  @default(true) @map("is_active")

  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  // Relations
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, provider])
  @@map("oauth_applications")
}
```

### OAuthConnection Table

Stores user tokens (refresh tokens) for active OAuth connections:

```prisma
model OAuthConnection {
  id             String   @id @default(cuid())
  projectId      String   @map("project_id")
  provider       OAuthProvider

  // Encrypted tokens
  refreshToken   String   @map("refresh_token") @db.Text
  encryptionIv   String   @map("encryption_iv")

  // Token metadata
  scopes         String[] @default([])
  expiresAt      DateTime? @map("expires_at")

  // Provider user info
  providerUserId String?  @map("provider_user_id")
  providerEmail  String?  @map("provider_email")

  // Connection status
  isActive       Boolean  @default(true) @map("is_active")
  lastRefreshed  DateTime? @map("last_refreshed")
  refreshFailed  Boolean  @default(false) @map("refresh_failed")
  failureReason  String?  @map("failure_reason")

  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  // Relations
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, provider])
  @@map("oauth_connections")
}
```

## API Endpoints

### 1. Register OAuth Application

Register a Linear OAuth app for a project:

```bash
POST /api/v1/auth/apps/register
Content-Type: application/json

{
  "projectId": "project-123",
  "provider": "LINEAR",
  "clientId": "your-linear-client-id",
  "clientSecret": "your-linear-client-secret",
  "redirectUri": "https://api.yourdomain.com/api/v1/auth/linear/callback",
  "scopes": ["read", "write", "issues:create", "comments:create"],
  "flowType": "authorization_code",
  "name": "Client A - DevFlow Integration",
  "description": "OAuth app for Client A's Linear workspace"
}
```

**Response:**
```json
{
  "message": "OAuth application registered successfully",
  "app": {
    "id": "app-abc123",
    "projectId": "project-123",
    "provider": "LINEAR",
    "clientId": "your-linear-client-id",
    "redirectUri": "https://api.yourdomain.com/api/v1/auth/linear/callback",
    "scopes": ["read", "write", "issues:create", "comments:create"],
    "flowType": "authorization_code",
    "name": "Client A - DevFlow Integration",
    "description": "OAuth app for Client A's Linear workspace",
    "isActive": true,
    "createdAt": "2025-12-08T10:00:00.000Z",
    "updatedAt": "2025-12-08T10:00:00.000Z"
  }
}
```

**Notes:**
- `clientSecret` is automatically encrypted before storage
- Upserting is supported - reregistering will update existing app
- `flowType` must be either `device` or `authorization_code`

### 2. List OAuth Applications

Get all OAuth apps for a project:

```bash
GET /api/v1/auth/apps?project=project-123
```

**Response:**
```json
{
  "apps": [
    {
      "id": "app-abc123",
      "projectId": "project-123",
      "provider": "LINEAR",
      "clientId": "your-linear-client-id",
      "redirectUri": "https://api.yourdomain.com/api/v1/auth/linear/callback",
      "scopes": ["read", "write", "issues:create", "comments:create"],
      "flowType": "authorization_code",
      "name": "Client A - DevFlow Integration",
      "isActive": true,
      "createdAt": "2025-12-08T10:00:00.000Z",
      "updatedAt": "2025-12-08T10:00:00.000Z"
    }
  ]
}
```

**Notes:**
- `clientSecret` is never exposed in responses
- Only returns apps for the specified project

### 3. Delete OAuth Application

Delete an OAuth app and revoke its connections:

```bash
POST /api/v1/auth/apps/linear/delete
Content-Type: application/json

{
  "projectId": "project-123"
}
```

**Response:**
```json
{
  "message": "OAuth application deleted successfully"
}
```

**Notes:**
- Automatically revokes any active OAuth connections
- Deletes encrypted credentials from database

### 4. Initiate OAuth Flow

After registering an OAuth app, initiate the authorization flow:

```bash
POST /api/v1/auth/linear/authorize
Content-Type: application/json

{
  "projectId": "project-123"
}
```

**Response:**
```json
{
  "authorizationUrl": "https://linear.app/oauth/authorize?client_id=...&redirect_uri=...&scope=...&state=xyz&response_type=code&prompt=consent",
  "message": "Please visit the authorization URL in your browser"
}
```

**Flow:**
1. User visits the authorization URL
2. User authorizes DevFlow to access their Linear workspace
3. Linear redirects to callback URL with authorization code
4. DevFlow exchanges code for access + refresh tokens
5. Tokens are encrypted and stored in `OAuthConnection` table

### 5. OAuth Callback (Automatic)

This endpoint is called automatically by Linear after user authorization:

```bash
GET /api/v1/auth/linear/callback?code=xxx&state=xxx&project=project-123
```

**Response:**
```json
{
  "success": true,
  "message": "Linear OAuth connection established successfully!",
  "connection": {
    "id": "conn-xyz789",
    "projectId": "project-123",
    "provider": "LINEAR",
    "scopes": ["read", "write", "issues:create", "comments:create"],
    "providerUserId": "user-abc",
    "providerEmail": "user@example.com",
    "isActive": true,
    "createdAt": "2025-12-08T10:05:00.000Z"
  }
}
```

## Setup Guide: New Client Onboarding

### Step 1: Client Creates Linear OAuth App

1. Client goes to https://linear.app/settings/api/applications
2. Click "Create new application"
3. Fill in:
   ```
   Application Name: DevFlow - [Client Name]
   Description: DevFlow OAuth integration
   Redirect URI: https://api.yourdomain.com/api/v1/auth/linear/callback
   Scopes: read, write, issues:create, comments:create
   ```
4. Click "Create application"
5. Save CLIENT_ID and CLIENT_SECRET (shown once!)

### Step 2: Register OAuth App in DevFlow

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/apps/register \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "client-a-project",
    "provider": "LINEAR",
    "clientId": "CLIENT_ID_FROM_STEP_1",
    "clientSecret": "CLIENT_SECRET_FROM_STEP_1",
    "redirectUri": "https://api.yourdomain.com/api/v1/auth/linear/callback",
    "scopes": ["read", "write", "issues:create", "comments:create"],
    "flowType": "authorization_code",
    "name": "Client A - Production",
    "description": "OAuth app for Client A Linear workspace"
  }'
```

### Step 3: Connect Client's Linear Workspace

```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/linear/authorize \
  -H "Content-Type: application/json" \
  -d '{"projectId": "client-a-project"}'
```

Response contains authorization URL. Client visits URL in browser to authorize.

### Step 4: Verify Connection

```bash
curl https://api.yourdomain.com/api/v1/auth/connections?project=client-a-project
```

Should show active Linear connection for Client A.

## Security Features

### 1. Encrypted Credentials

- `clientSecret` encrypted with AES-256-GCM before database storage
- Each encrypted value has unique IV (initialization vector)
- Encryption key stored in environment: `OAUTH_ENCRYPTION_KEY`

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add to `.env`:
```bash
OAUTH_ENCRYPTION_KEY=your_generated_key_here
```

### 2. Per-Project Isolation

- OAuth apps scoped to `projectId`
- Unique constraint: `(projectId, provider)`
- CASCADE delete: deleting project deletes all OAuth apps

### 3. Token Refresh & Rotation

- Access tokens cached in Redis with 5-minute buffer before expiration
- Refresh tokens automatically rotated on each refresh (Linear security requirement)
- Failed refreshes logged with `refreshFailed` flag

### 4. CSRF Protection

- State parameter validated during OAuth callback
- State stored in Redis with 10-minute TTL
- Invalid state = potential CSRF attack

## Migration from Environment Variables

If you have existing LINEAR_OAUTH_CLIENT_ID / LINEAR_OAUTH_CLIENT_SECRET in `.env`:

### Option 1: Register Existing App

```bash
curl -X POST http://localhost:3000/api/v1/auth/apps/register \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-default-project",
    "provider": "LINEAR",
    "clientId": "'$LINEAR_OAUTH_CLIENT_ID'",
    "clientSecret": "'$LINEAR_OAUTH_CLIENT_SECRET'",
    "redirectUri": "'$LINEAR_OAUTH_REDIRECT_URI'",
    "scopes": ["read", "write", "issues:create", "comments:create"],
    "flowType": "authorization_code",
    "name": "Legacy OAuth App",
    "description": "Migrated from environment variables"
  }'
```

### Option 2: Clean Install

1. Remove LINEAR_OAUTH_* from `.env`
2. Create new Linear OAuth apps per client
3. Register each via `/api/v1/auth/apps/register`

## Monitoring & Troubleshooting

### Check Registered Apps

```bash
curl http://localhost:3000/api/v1/auth/apps?project=project-123
```

### Check Active Connections

```bash
curl http://localhost:3000/api/v1/auth/connections?project=project-123
```

### Force Token Refresh

```bash
curl -X POST http://localhost:3000/api/v1/auth/linear/refresh \
  -H "Content-Type: application/json" \
  -d '{"projectId": "project-123"}'
```

### Common Errors

**Error:** `No active OAuth application configured for LINEAR on project project-123`
**Solution:** Register OAuth app first via `/api/v1/auth/apps/register`

**Error:** `Invalid state parameter - possible CSRF attack`
**Solution:** State expired (>10 min). Initiate new authorization flow.

**Error:** `Failed to refresh token`
**Solution:** Check `OAuthConnection.refreshFailed` and `failureReason`. May need to reconnect.

## Related Documentation

- [Linear OAuth Setup Guide](./LINEAR_OAUTH_SETUP.md) - Original single-tenant guide
- [GitHub OAuth Setup](./GITHUB_OAUTH_SETUP.md) - GitHub Device Flow
- [OAuth Architecture](./OAUTH_ARCHITECTURE.md) - Technical deep dive
- [Security Best Practices](./SECURITY.md) - Security guidelines

## Next Steps

1. **Deploy to Production**: Update `redirectUri` to production domain
2. **Client Onboarding**: Document OAuth app creation for clients
3. **Monitoring**: Set up alerts for failed token refreshes
4. **Audit Logs**: Track OAuth app registration/deletion events
