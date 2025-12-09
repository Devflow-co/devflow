# Linear OAuth Setup Guide

## Overview

DevFlow uses OAuth Authorization Code Flow to securely connect to Linear workspaces. This provides per-project OAuth connections with automatic token refresh.

## Prerequisites

- DevFlow API running on port 3000 (or configured port)
- Access to Linear workspace with admin permissions
- Internet-accessible callback URL (use ngrok for local development)

## Step 1: Create Linear OAuth Application

1. Navigate to Linear Settings:
   - Go to https://linear.app/settings/api/applications
   - Or: Settings → API → OAuth applications

2. Click **"Create new application"**

3. Fill in application details:
   ```
   Application Name: DevFlow (or your preferred name)
   Description: DevFlow OAuth integration for automated workflow management
   Redirect URI: http://localhost:3000/api/v1/auth/linear/callback
   Homepage URL: https://github.com/your-org/devflow (optional)
   ```

4. Select required scopes:
   - ✅ `read` - Read access to Linear data
   - ✅ `write` - Write access to Linear data
   - ✅ `issues:create` - Create issues and attachments
   - ✅ `comments:create` - Create issue comments

5. Click **"Create application"**

6. **Save your credentials**:
   - Client ID (visible)
   - Client Secret (shown once - save it immediately!)

## Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Linear OAuth Configuration
LINEAR_OAUTH_CLIENT_ID=your_client_id_here
LINEAR_OAUTH_CLIENT_SECRET=your_client_secret_here
LINEAR_OAUTH_REDIRECT_URI=http://localhost:3000/api/v1/auth/linear/callback
```

**Production Setup:**
For production, update the redirect URI to your actual API domain:
```bash
LINEAR_OAUTH_REDIRECT_URI=https://api.yourdomain.com/api/v1/auth/linear/callback
```

## Step 3: Local Development with Ngrok

If developing locally and need external callback access:

1. Start ngrok:
   ```bash
   ngrok http 3000
   ```

2. Update Linear OAuth app redirect URI:
   ```
   https://your-ngrok-url.ngrok.io/api/v1/auth/linear/callback
   ```

3. Update `.env`:
   ```bash
   LINEAR_OAUTH_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/v1/auth/linear/callback
   ```

## Step 4: Initiate OAuth Flow

### Option A: Using cURL

1. Request authorization URL:
   ```bash
   curl -X POST http://localhost:3000/api/v1/auth/linear/authorize \
     -H "Content-Type: application/json" \
     -d '{"projectId": "your-project-id"}'
   ```

   Response:
   ```json
   {
     "authorizationUrl": "https://linear.app/oauth/authorize?client_id=...",
     "message": "Please visit the authorization URL in your browser"
   }
   ```

2. Visit the authorization URL in your browser

3. Authorize DevFlow to access your Linear workspace

4. You'll be redirected to the callback URL with success message

### Option B: Using the DevFlow CLI (Coming Soon)

```bash
devflow auth connect linear --project your-project-id
```

## Step 5: Verify Connection

Check active OAuth connections:

```bash
curl http://localhost:3000/api/v1/auth/connections?project=your-project-id
```

Response should include Linear connection:
```json
{
  "connections": [
    {
      "id": "...",
      "projectId": "your-project-id",
      "provider": "LINEAR",
      "scopes": ["read", "write", "issues:create", "comments:create"],
      "providerUserId": "your-linear-user-id",
      "providerEmail": "user@example.com",
      "isActive": true,
      "lastRefreshed": "2025-12-08T12:00:00.000Z",
      "createdAt": "2025-12-08T12:00:00.000Z"
    }
  ]
}
```

## How It Works

### Authorization Code Flow

```
┌─────────┐                                  ┌─────────┐
│ DevFlow │                                  │ Linear  │
│   API   │                                  │  OAuth  │
└────┬────┘                                  └────┬────┘
     │                                            │
     │ 1. POST /auth/linear/authorize            │
     │    { projectId: "xxx" }                   │
     │                                            │
     │ 2. Returns authorization URL              │
     │    with random state                      │
     │◄───────────────────────────────────────   │
     │                                            │
     │ 3. User visits URL in browser ────────────►
     │                                            │
     │                                       4. User authorizes
     │                                            │
     │ 5. Linear redirects to callback  ◄────────│
     │    with code & state                      │
     │                                            │
     │ 6. Validate state (CSRF protection)       │
     │                                            │
     │ 7. Exchange code for tokens ──────────────►
     │                                            │
     │ 8. Receive access + refresh tokens ◄──────│
     │                                            │
     │ 9. Encrypt & store tokens in DB           │
     │    + cache access token in Redis          │
     │                                            │
     │ 10. Return success to user                │
     │                                            │
```

### Token Refresh

- **Access tokens**: Valid for 24 hours
- **Refresh tokens**: Rotated on each refresh (for security)
- **Auto-refresh**: Tokens are automatically refreshed when they expire
- **Cache**: Access tokens cached in Redis with 5-minute buffer before expiration

### Security Features

1. **State Parameter**: CSRF protection using random state stored in Redis
2. **Token Encryption**: Refresh tokens encrypted with AES-256-GCM
3. **Secure Storage**: Tokens never exposed in API responses
4. **Per-Project Isolation**: Each project has separate OAuth connections
5. **Token Rotation**: Refresh tokens rotate on each refresh

## Troubleshooting

### "Invalid redirect_uri" Error

**Cause**: Redirect URI mismatch between Linear app config and environment variable

**Solution**: Ensure both match exactly:
- Linear App Redirect URI: `http://localhost:3000/api/v1/auth/linear/callback`
- `.env` LINEAR_OAUTH_REDIRECT_URI: `http://localhost:3000/api/v1/auth/linear/callback`

### "Invalid state parameter" Error

**Cause**: State expired (> 10 minutes) or Redis connection issue

**Solution**:
- Ensure Redis is running: `docker-compose ps redis`
- Complete authorization within 10 minutes of initiating
- Try again with fresh authorization request

### "Client authentication failed" Error

**Cause**: Invalid client_secret or client_id

**Solution**:
- Verify `LINEAR_OAUTH_CLIENT_ID` matches Linear app
- Verify `LINEAR_OAUTH_CLIENT_SECRET` is correct (regenerate if needed)
- Restart API after changing environment variables

### Tokens Not Refreshing

**Cause**: Missing refresh token or encryption key issue

**Solution**:
- Check `OAUTH_ENCRYPTION_KEY` is set in `.env`
- Disconnect and reconnect Linear OAuth
- Check logs for refresh errors: `docker-compose logs api`

## API Endpoints

### Initiate OAuth
```
POST /api/v1/auth/linear/authorize
Content-Type: application/json

{
  "projectId": "your-project-id"
}

Response:
{
  "authorizationUrl": "https://linear.app/oauth/authorize?...",
  "message": "Please visit the authorization URL in your browser"
}
```

### OAuth Callback (Automatic)
```
GET /api/v1/auth/linear/callback?code=xxx&state=xxx&project=projectId

Response:
{
  "success": true,
  "message": "Linear OAuth connection established successfully!",
  "connection": { ... }
}
```

### List Connections
```
GET /api/v1/auth/connections?project=your-project-id

Response:
{
  "connections": [...]
}
```

### Disconnect OAuth
```
POST /api/v1/auth/linear/disconnect
Content-Type: application/json

{
  "projectId": "your-project-id"
}

Response:
{
  "message": "OAuth connection revoked successfully"
}
```

### Force Token Refresh
```
POST /api/v1/auth/linear/refresh
Content-Type: application/json

{
  "projectId": "your-project-id"
}

Response:
{
  "message": "Token refreshed successfully"
}
```

## Next Steps

1. **Configure Worker OAuth**: Update worker to use Linear OAuth tokens
2. **Test Workflows**: Verify Linear API calls use OAuth tokens
3. **Monitor Tokens**: Check token refresh logs in production
4. **Update Documentation**: Add Linear OAuth to main README

## Related Documentation

- [GitHub OAuth Setup](./GITHUB_OAUTH_SETUP.md)
- [OAuth Architecture](./OAUTH_ARCHITECTURE.md)
- [Security Best Practices](./SECURITY.md)
