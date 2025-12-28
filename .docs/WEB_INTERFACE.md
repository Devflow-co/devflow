# DevFlow Web Interface Documentation

**Version:** 2.5.0
**Package:** `@devflow/web`
**Framework:** Nuxt 4, Vue 3, Tailwind CSS, Pinia
**Status:** Production Ready

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Getting Started](#getting-started)
5. [Authentication](#authentication)
6. [Project Management](#project-management)
7. [OAuth Integration Management](#oauth-integration-management)
8. [Components Reference](#components-reference)
9. [State Management](#state-management)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The DevFlow Web Interface is a modern, responsive frontend application that provides a complete user interface for managing DevFlow projects, OAuth integrations, and workflows. Built with Nuxt 4 and Vue 3, it offers a seamless experience for developers to connect their tools (GitHub, Linear, Figma, Sentry) and configure automated workflows.

**Key Capabilities:**
- ✅ User authentication with email/password and SSO (Google, GitHub)
- ✅ Multi-project management with organization-based access control
- ✅ OAuth integration management (Connect, Test, Disconnect)
- ✅ Visual status indicators and real-time stats
- ✅ Dark mode support
- ✅ Responsive design (mobile, tablet, desktop)

---

## Architecture

### Technology Stack

```
Frontend Stack:
├── Nuxt 4 - Vue meta-framework with SSR/SSG
├── Vue 3 - Composition API
├── Pinia - State management
├── Tailwind CSS - Utility-first styling
├── TypeScript - Type safety
└── Vite - Build tool

Backend Integration:
├── REST API - NestJS API (port 3000)
├── Session Auth - httpOnly cookies
└── OAuth 2.0 - Authorization Code Flow
```

### Project Structure

```
packages/web/
├── app/
│   ├── components/          # Reusable Vue components
│   │   ├── AppNavbar.vue
│   │   ├── ProjectSelector.vue
│   │   ├── IntegrationCard.vue
│   │   └── StatusBadge.vue
│   ├── composables/         # Vue composables
│   │   ├── auth.ts          # Authentication store & methods
│   │   └── api.ts           # API wrapper with credentials
│   ├── middleware/          # Route middleware
│   │   └── auth.ts          # Protected route guard
│   ├── pages/               # Page components (auto-routing)
│   │   ├── index.vue        # Landing page
│   │   ├── login.vue
│   │   ├── signup.vue
│   │   ├── dashboard/
│   │   │   └── index.vue
│   │   └── projects/
│   │       ├── index.vue    # Project list
│   │       ├── [id].vue     # Project detail
│   │       └── new.vue      # New project form
│   ├── stores/              # Pinia stores
│   │   ├── projects.ts      # Project CRUD & selection
│   │   └── integrations.ts  # OAuth management
│   └── app.vue              # Root component
├── public/                  # Static assets
├── nuxt.config.ts           # Nuxt configuration
└── package.json
```

### Design Decisions

1. **Organizations-Based Multi-tenancy**
   - Users belong to Organizations (personal org created on signup)
   - Projects are linked to Organizations via `OrganizationProject`
   - Access control enforced at API level (AuthGuard + organization membership)

2. **Session-Based Authentication**
   - httpOnly cookies prevent XSS attacks
   - Redis-backed sessions for scalability
   - CSRF protection via SameSite cookies

3. **OAuth Popup Flow with Polling**
   - Opens OAuth provider in popup window
   - Polls API every 1s for connection status
   - Auto-closes popup on success or 60s timeout
   - Better UX than full-page redirects

4. **Pinia for State Management**
   - Composition API style for cleaner code
   - SSR-safe with `import.meta.client` checks
   - localStorage persistence for selected project

---

## Features

### 1. User Authentication

**Available Methods:**
- Email/Password (with email verification)
- Google OAuth
- GitHub OAuth

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Email Verification:**
- Verification email sent on signup
- 24-hour token validity
- Resend verification available
- Some features locked until verified

### 2. Dashboard

**Statistics:**
- Total projects count
- Connected integrations count
- Total tasks across all projects
- Active workflows count

**Quick Actions:**
- Navigate to Projects list
- Navigate to Integrations (if project selected)
- Workflows (coming soon)
- Analytics (coming soon)

### 3. Project Management

**CRUD Operations:**
- ✅ Create new project with name, description, repository, workspace path
- ✅ List all projects (filtered by user's organizations)
- ✅ View project details with tasks and workflows
- ✅ Update project information
- ✅ Delete project (soft delete)

**Project Selection:**
- Dropdown selector in navbar
- Selected project persisted in localStorage
- Auto-restore on page refresh
- Validation to ensure project still exists

### 4. OAuth Integration Management

**Supported Providers:**
- GitHub - Repository access, Actions, Issues
- Linear - Issue tracking, custom fields, teams
- Figma - Design files, comments, screenshots
- Sentry - Error tracking, events, issues

**Per-Provider Actions:**
- **Connect** - Opens OAuth popup, polls for completion
- **Test** - Validates connection and fetches sample data
- **Disconnect** - Revokes access token
- **Configure** - Provider-specific settings (file keys, slugs, repos)

**Connection Details Displayed:**
- Status badge (Connected, Error, Not Configured, Disconnected)
- OAuth scopes granted
- Connected user email
- Last token refresh timestamp
- Error messages if connection failed

**Provider-Specific Configuration:**
- **GitHub:** Default repository (owner/repo)
- **Linear:** No additional config
- **Figma:** File Key + Node ID (optional)
- **Sentry:** Organization Slug + Project Slug

---

## Getting Started

### Installation

```bash
# Navigate to web package
cd packages/web

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3001` (API must be running on port 3000).

### Environment Variables

```bash
# packages/web/.env

# API URL (development)
NUXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Frontend URL (for OAuth callbacks)
NUXT_PUBLIC_FRONTEND_URL=http://localhost:3001

# Production settings
# NUXT_PUBLIC_API_URL=https://api.devflow.io/api/v1
# NUXT_PUBLIC_FRONTEND_URL=https://app.devflow.io
```

### First Run

1. **Start Infrastructure:**
   ```bash
   docker-compose up -d postgres redis
   ```

2. **Run Database Migrations:**
   ```bash
   pnpm --filter @devflow/api db:migrate
   ```

3. **Start API:**
   ```bash
   pnpm --filter @devflow/api dev
   ```

4. **Start Web Frontend:**
   ```bash
   pnpm --filter @devflow/web dev
   ```

5. **Visit** `http://localhost:3001` and sign up for an account.

---

## Authentication

### User Signup Flow

```
1. User visits /signup
2. Fills email, name, password
3. POST /api/v1/user-auth/signup
4. Personal organization created automatically
5. Session created with httpOnly cookie
6. Verification email sent
7. Redirect to /dashboard
```

### User Login Flow

```
1. User visits /login
2. Enters email, password
3. POST /api/v1/user-auth/login
4. Session created with httpOnly cookie
5. Redirect to /dashboard (or previous protected page)
```

### SSO Login Flow (Google/GitHub)

```
1. User clicks "Sign in with Google"
2. GET /api/v1/user-auth/google
3. Redirected to Google OAuth consent screen
4. User authorizes
5. Callback to /api/v1/user-auth/google/callback
6. User found or created (SSO user)
7. Personal organization created (if new user)
8. Session created with httpOnly cookie
9. Redirect to /dashboard
```

### Session Management

**Implementation:**
- httpOnly cookie named `devflow_session`
- Stored in Redis with 7-day TTL
- SameSite=Lax for CSRF protection
- Secure flag in production

**Middleware:**
```typescript
// app/middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
```

**Protected Pages:**
```typescript
definePageMeta({
  middleware: 'auth', // Requires authentication
})
```

---

## Project Management

### Creating a Project

**UI Flow:**
1. Navigate to `/projects`
2. Click "Create New Project"
3. Fill form:
   - **Name** (required) - Project display name
   - **Description** (optional) - Project description
   - **Repository** (optional) - Git repository URL
   - **Workspace Path** (optional) - Local workspace path
4. Click "Create Project"
5. Project created and linked to user's personal organization
6. Redirect to `/projects/{id}` for integration setup

**API Call:**
```typescript
POST /api/v1/projects
Content-Type: application/json
Cookie: devflow_session=xxx

{
  "name": "My Project",
  "description": "Project description",
  "repository": "https://github.com/owner/repo",
  "workspacePath": "/path/to/workspace"
}
```

### Listing Projects

**UI:** `/projects` page displays grid of project cards with:
- Project name and description
- Creation date
- Integration status badges (4 providers)
- Task and workflow counts
- Delete button

**API Call:**
```typescript
GET /api/v1/projects
Cookie: devflow_session=xxx

// Returns only projects accessible by authenticated user
```

### Selecting a Project

**UI:** Project selector dropdown in navbar
- Shows all user's projects
- "Create New Project" link at bottom
- Selected project highlighted
- Persisted in localStorage

**State Management:**
```typescript
// stores/projects.ts
const projectsStore = useProjectsStore()

// Select a project
projectsStore.selectProject('project-id')

// Get selected project
const selectedProject = computed(() => projectsStore.selectedProject)

// Restore from localStorage
projectsStore.restoreSelectedProject()
```

---

## OAuth Integration Management

### Connecting an Integration

**UI Flow:**
1. Navigate to `/projects/{id}`
2. Click "Integrations" tab
3. Find integration card (e.g., GitHub)
4. Click "Connect" button
5. OAuth popup opens automatically
6. User authorizes on provider website
7. Popup closes automatically when connection detected
8. Status badge updates to "Connected"
9. Connection details displayed

**Implementation:**
```typescript
// stores/integrations.ts
const integrationsStore = useIntegrationsStore()

// Connect OAuth
await integrationsStore.connectOAuth('project-id', 'GITHUB')

// Internally:
// 1. POST /auth/github/authorize → get authorizationUrl
// 2. Open popup window with authorizationUrl
// 3. Poll GET /auth/connections?project={id} every 1s
// 4. Detect when connection.isActive === true
// 5. Close popup automatically
// 6. Update connections state
```

**Polling Mechanism:**
```typescript
const pollForConnection = async (projectId: string, provider: OAuthProvider) => {
  return new Promise((resolve, reject) => {
    const pollInterval = 1000 // 1 second
    const timeout = setTimeout(() => {
      clearInterval(polling)
      reject(new Error('OAuth connection timeout (60s)'))
    }, 60000)

    const polling = setInterval(async () => {
      const response = await apiFetch<{ connections: OAuthConnection[] }>(
        `/auth/connections?project=${projectId}`
      )

      const connection = response.connections.find(
        (c) => c.provider === provider && c.isActive
      )

      if (connection) {
        clearTimeout(timeout)
        clearInterval(polling)
        closePopup()
        resolve()
      }
    }, pollInterval)
  })
}
```

### Testing a Connection

**UI Flow:**
1. Integration must be connected
2. Click "Test Connection" button
3. Loading spinner shown
4. Test result displayed (success/error)
5. Sample data shown (e.g., repository name, issue count)

**Implementation:**
```typescript
await integrationsStore.testConnection('project-id', 'GITHUB')

// POST /integrations/test/github
// Body: { projectId: 'project-id' }
// Returns: { status: 'connected', testResult: '...', details: {...} }
```

**Test Validation per Provider:**
- **GitHub:** Fetch repository info + list issues
- **Linear:** Query issues by status
- **Figma:** Fetch file metadata + comments
- **Sentry:** Fetch project issues + events

### Disconnecting an Integration

**UI Flow:**
1. Click "Disconnect" button
2. Confirmation dialog shown
3. Confirm disconnection
4. Token revoked on API side
5. Status badge updates to "Disconnected"
6. Connection details cleared

**Implementation:**
```typescript
await integrationsStore.disconnectOAuth('project-id', 'GITHUB')

// POST /auth/github/disconnect
// Body: { projectId: 'project-id' }
```

### Configuring Integration Settings

**Provider-Specific Forms:**

**GitHub:**
```typescript
{
  githubIssuesRepo: 'owner/repo' // Default repository for issues
}
```

**Linear:**
```typescript
// No additional configuration required
```

**Figma:**
```typescript
{
  figmaFileKey: 'TfJw2zsGB11mbievCt5c3n',  // 20-30 chars
  figmaNodeId: '0-1'                         // Optional frame ID
}
```

**Sentry:**
```typescript
{
  sentryOrgSlug: 'my-organization',
  sentryProjectSlug: 'my-project'
}
```

**API Call:**
```typescript
PUT /api/v1/projects/{id}/integrations
Content-Type: application/json

{
  "githubIssuesRepo": "facebook/react",
  "figmaFileKey": "TfJw2zsGB11mbievCt5c3n",
  "figmaNodeId": "0-1",
  "sentryOrgSlug": "my-org",
  "sentryProjectSlug": "my-project"
}
```

---

## Components Reference

### AppNavbar.vue

**Purpose:** Global navigation bar

**Features:**
- DevFlow logo and brand
- Navigation links (Dashboard, Projects)
- Project selector dropdown
- User menu with logout
- Mobile-responsive burger menu

**Usage:**
```vue
<AppNavbar v-if="showNavbar" />
```

### ProjectSelector.vue

**Purpose:** Dropdown for selecting active project

**Features:**
- Lists all user projects
- Shows selected project
- "Create New Project" link
- Keyboard navigation support
- Click outside to close

**Usage:**
```vue
<ProjectSelector v-if="hasProjects" />
```

**State:**
```typescript
const projectsStore = useProjectsStore()
const { projects, selectedProject } = storeToRefs(projectsStore)
```

### IntegrationCard.vue

**Purpose:** Display and manage a single OAuth integration

**Props:**
```typescript
interface Props {
  provider: 'GITHUB' | 'LINEAR' | 'FIGMA' | 'SENTRY'
}
```

**Features:**
- Provider logo and name
- Status badge (connected/error/disconnected/not_configured)
- Connect/Disconnect/Test buttons
- Connection details (scopes, email, last refresh)
- Configuration form slot
- Error messages

**Usage:**
```vue
<IntegrationCard provider="GITHUB">
  <template #config>
    <!-- Provider-specific configuration form -->
    <div class="space-y-4">
      <div>
        <label>Default Repository</label>
        <input v-model="githubIssuesRepo" />
      </div>
    </div>
  </template>
</IntegrationCard>
```

**Computed Properties:**
```typescript
const connection = computed(() =>
  integrationsStore.getProviderConnection(props.provider)
)
const isConnected = computed(() =>
  integrationsStore.isProviderConnected(props.provider)
)
const testResult = computed(() =>
  integrationsStore.testResults.get(props.provider)
)
```

### StatusBadge.vue

**Purpose:** Visual status indicator

**Props:**
```typescript
interface Props {
  status: 'connected' | 'error' | 'disconnected' | 'not_configured'
}
```

**Visual States:**
- **Connected:** Green background, green dot
- **Error:** Red background, red dot
- **Disconnected:** Gray background, gray dot
- **Not Configured:** Yellow background, yellow dot

**Usage:**
```vue
<StatusBadge :status="connectionStatus" />
```

---

## State Management

### Projects Store (`stores/projects.ts`)

**State:**
```typescript
{
  projects: Project[]           // All user projects
  selectedProjectId: string | null
  loading: boolean
  error: string | null
}
```

**Getters:**
```typescript
{
  selectedProject: Project | undefined
  hasProjects: boolean
}
```

**Actions:**
```typescript
fetchProjects()                       // GET /projects
selectProject(id: string | null)     // Set selected + save to localStorage
restoreSelectedProject()             // Load from localStorage
createProject(dto: CreateProjectDto) // POST /projects
updateProject(id, dto)               // PUT /projects/:id
deleteProject(id)                    // DELETE /projects/:id
linkRepository(id, url)              // POST /projects/:id/link-repository
getProjectStatistics(id)             // GET /projects/:id/statistics
```

### Integrations Store (`stores/integrations.ts`)

**State:**
```typescript
{
  connections: OAuthConnection[]
  integrationConfig: ProjectIntegration | null
  testResults: Map<Provider, TestResult>
  loading: boolean
  error: string | null
  oauthPopup: Window | null           // OAuth popup reference
  oauthPolling: NodeJS.Timeout | null // Polling interval
}
```

**Getters:**
```typescript
{
  isProviderConnected(provider): boolean
  getProviderConnection(provider): OAuthConnection | undefined
}
```

**Actions:**
```typescript
fetchConnections(projectId)               // GET /auth/connections?project={id}
fetchIntegrationConfig(projectId)         // GET /projects/:id/integrations
connectOAuth(projectId, provider)         // Popup flow + polling
disconnectOAuth(projectId, provider)      // POST /auth/:provider/disconnect
testConnection(projectId, provider)       // POST /integrations/test/:provider
updateIntegrationConfig(projectId, config) // PUT /projects/:id/integrations
clearTestResults()                        // Clear all test results
```

**SSR Safety:**
```typescript
// Always check for client-side before using window/localStorage
if (import.meta.client) {
  localStorage.setItem('key', value)
}
```

---

## Security

### Authentication Security

**Session Security:**
- httpOnly cookies prevent XSS access to session token
- SameSite=Lax prevents CSRF attacks
- Secure flag in production (HTTPS only)
- Redis-backed sessions with TTL
- Session invalidation on logout

**Password Security:**
- Bcrypt hashing with salt rounds
- Password strength validation
- No password in logs or error messages

**OAuth Security:**
- PKCE flow for public clients (future)
- State parameter for CSRF protection
- Token encryption at rest (AES-256-GCM)
- Refresh tokens stored encrypted in database
- Access tokens never logged

### Authorization Security

**Organization-Based Access Control:**
- All API endpoints protected with AuthGuard
- Project access verified via organization membership
- Endpoints return 403 Forbidden if no access
- User can only see/modify their organization's projects

**Example Authorization Check:**
```typescript
@UseGuards(AuthGuard)
async findOne(@Param('id') id: string, @CurrentUser() user: User) {
  // Verify user has access to this project
  const hasAccess = await this.projectsService.userHasAccess(id, user.id)
  if (!hasAccess) {
    throw new ForbiddenException('Access denied to this project')
  }
  return this.projectsService.findOne(id)
}
```

### Data Validation

**Input Validation:**
- All DTOs validated with class-validator
- Email format validation
- URL validation for repositories
- Length limits on text fields
- SQL injection prevention via Prisma ORM

**Output Sanitization:**
- Sensitive fields excluded from API responses
- Password hashes never returned
- OAuth secrets never exposed to frontend

---

## Troubleshooting

### Common Issues

#### 1. "Session expired" on page load

**Symptom:** Immediately redirected to login page after successful login

**Cause:** Cookie not being sent with requests

**Fix:**
```typescript
// composables/api.ts
export const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  return $fetch<T>(`${API_URL}${url}`, {
    ...options,
    credentials: 'include', // ← Must be set!
  })
}
```

#### 2. OAuth popup blocked by browser

**Symptom:** Popup window doesn't open when clicking "Connect"

**Cause:** Browser popup blocker

**Fix:**
- Ensure user action directly triggers popup (not async callback)
- Add site to browser's allowed popups list
- Use full-page redirect as fallback (future feature)

#### 3. OAuth polling never completes

**Symptom:** Popup stays open, connection never detected

**Possible Causes:**
- OAuth callback failed (check API logs)
- Token not saved to database
- Wrong project ID in polling URL

**Debug:**
```bash
# Check API logs
docker-compose logs -f api

# Manually check connections
curl http://localhost:3000/api/v1/auth/connections?project=<project-id> \
  -H "Cookie: devflow_session=<session-cookie>"
```

#### 4. "Access denied to this project"

**Symptom:** 403 error when accessing project

**Cause:** User not member of project's organization

**Fix:**
```sql
-- Check organization membership
SELECT * FROM "OrganizationMember" WHERE "userId" = '<user-id>';

-- Check project-organization link
SELECT * FROM "OrganizationProject" WHERE "projectId" = '<project-id>';
```

#### 5. Selected project not persisting

**Symptom:** Selected project resets on page refresh

**Cause:** localStorage not being written

**Debug:**
```typescript
// stores/projects.ts
const selectProject = (projectId: string | null) => {
  selectedProjectId.value = projectId
  console.log('[ProjectsStore] Selecting project:', projectId)

  if (import.meta.client) {
    console.log('[ProjectsStore] Saving to localStorage')
    if (projectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, projectId)
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY)
    }
  } else {
    console.log('[ProjectsStore] SSR mode, skipping localStorage')
  }
}
```

#### 6. Integration test fails with "Token not found"

**Symptom:** Test connection fails even though connection shows as active

**Cause:** OAuth token expired and refresh failed

**Fix:**
```bash
# Force token refresh
curl -X POST http://localhost:3000/api/v1/auth/github/refresh \
  -H "Content-Type: application/json" \
  -H "Cookie: devflow_session=<session-cookie>" \
  -d '{"projectId": "<project-id>"}'

# Reconnect OAuth if refresh fails
# UI: Click "Disconnect" then "Connect" again
```

### Development Tips

**1. Hot Module Replacement Issues:**
```bash
# Restart dev server if HMR breaks
pnpm dev

# Clear Nuxt cache
rm -rf .nuxt
pnpm dev
```

**2. TypeScript Errors:**
```bash
# Regenerate types
pnpm dev --clean

# Check types
pnpm typecheck
```

**3. Debugging API Calls:**
```typescript
// composables/api.ts
export const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  console.log('[API] Request:', options.method || 'GET', url, options.body)

  const response = await $fetch<T>(`${API_URL}${url}`, {
    ...options,
    credentials: 'include',
  })

  console.log('[API] Response:', response)
  return response
}
```

---

## API Reference

### Authentication Endpoints

```
POST   /api/v1/user-auth/signup
POST   /api/v1/user-auth/login
POST   /api/v1/user-auth/logout
GET    /api/v1/user-auth/me
POST   /api/v1/user-auth/verify-email
POST   /api/v1/user-auth/resend-verification
POST   /api/v1/user-auth/forgot-password
POST   /api/v1/user-auth/reset-password
GET    /api/v1/user-auth/google
GET    /api/v1/user-auth/google/callback
GET    /api/v1/user-auth/github
GET    /api/v1/user-auth/github/callback
```

### Project Endpoints

```
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id
GET    /api/v1/projects/:id/statistics
POST   /api/v1/projects/:id/link-repository
GET    /api/v1/projects/:id/integrations
PUT    /api/v1/projects/:id/integrations
```

### OAuth Endpoints

```
POST   /api/v1/auth/github/authorize
GET    /api/v1/auth/github/callback
POST   /api/v1/auth/github/refresh
POST   /api/v1/auth/github/disconnect
POST   /api/v1/auth/linear/authorize
GET    /api/v1/auth/linear/callback
POST   /api/v1/auth/linear/refresh
POST   /api/v1/auth/linear/disconnect
POST   /api/v1/auth/figma/authorize
GET    /api/v1/auth/figma/callback
POST   /api/v1/auth/figma/refresh
POST   /api/v1/auth/figma/disconnect
POST   /api/v1/auth/sentry/authorize
GET    /api/v1/auth/sentry/callback
POST   /api/v1/auth/sentry/refresh
POST   /api/v1/auth/sentry/disconnect
GET    /api/v1/auth/connections?project={projectId}
POST   /api/v1/auth/apps/register
```

### Integration Test Endpoints

```
POST   /api/v1/integrations/test/github
POST   /api/v1/integrations/test/linear
POST   /api/v1/integrations/test/figma
POST   /api/v1/integrations/test/sentry
```

---

## Future Enhancements

**Planned Features:**
- [ ] Workflow execution UI (Phase 3 view)
- [ ] Real-time workflow status via WebSocket
- [ ] Analytics dashboard with charts
- [ ] Team collaboration (invite users to organizations)
- [ ] Activity feed (recent actions, workflow runs)
- [ ] Notification preferences
- [ ] API keys management (for CLI authentication)
- [ ] Two-factor authentication (2FA)
- [ ] OAuth connection health monitoring
- [ ] Bulk project actions
- [ ] Project templates

**Technical Improvements:**
- [ ] WebSocket for OAuth completion (replace polling)
- [ ] Service Worker for offline support
- [ ] PWA support (installable app)
- [ ] i18n (internationalization)
- [ ] Accessibility (WCAG 2.1 AA compliance)
- [ ] E2E tests with Playwright
- [ ] Storybook for component documentation

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and NestJS boundaries
- [OAUTH_MULTITENANT.md](./OAUTH_MULTITENANT.md) - OAuth multi-tenant architecture
- [LINEAR_OAUTH_SETUP.md](./LINEAR_OAUTH_SETUP.md) - Linear OAuth setup guide
- [SENTRY_OAUTH_SETUP.md](./SENTRY_OAUTH_SETUP.md) - Sentry OAuth setup guide
- [FIGMA_CONFIGURATION.md](./FIGMA_CONFIGURATION.md) - Figma integration configuration
- [CLAUDE.md](../CLAUDE.md) - Project instructions for AI assistants

---

**Last Updated:** December 28, 2025
**Maintainers:** DevFlow Team
**Status:** Production Ready
