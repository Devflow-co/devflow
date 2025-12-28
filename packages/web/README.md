# @devflow/web

**DevFlow Web Interface** - Modern frontend for managing DevFlow projects and OAuth integrations.

**Version:** 2.5.0
**Framework:** Nuxt 4, Vue 3, Pinia, Tailwind CSS
**Port:** 3001 (API on 3000)

## Overview

The DevFlow Web Interface provides a complete user experience for:
- User authentication (email/password, Google OAuth, GitHub OAuth)
- Project management (CRUD operations)
- OAuth integration management (GitHub, Linear, Figma, Sentry)
- Real-time dashboard with statistics
- Dark mode support

**Full Documentation:** [.docs/WEB_INTERFACE.md](../../.docs/WEB_INTERFACE.md)

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- DevFlow API running on port 3000
- PostgreSQL, Redis, and Temporal running (via docker-compose)

### Installation

```bash
# Install dependencies (from project root)
pnpm install

# Or from this package
cd packages/web
pnpm install
```

### Environment Variables

Create a `.env` file in `packages/web/`:

```bash
# API URL (development)
NUXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# Frontend URL (for OAuth callbacks)
NUXT_PUBLIC_FRONTEND_URL=http://localhost:3001

# Production
# NUXT_PUBLIC_API_URL=https://api.devflow.io/api/v1
# NUXT_PUBLIC_FRONTEND_URL=https://app.devflow.io
```

### Development

```bash
# Start development server
pnpm dev

# Or from project root
pnpm --filter @devflow/web dev
```

The application will be available at `http://localhost:3001`.

### Build for Production

```bash
# Build the application
pnpm build

# Preview production build
pnpm preview
```

---

## Features

### Authentication
- ✅ Email/Password with email verification
- ✅ Google OAuth
- ✅ GitHub OAuth
- ✅ Password reset flow
- ✅ Session-based auth with httpOnly cookies

### Project Management
- ✅ Create, read, update, delete projects
- ✅ Organization-based access control
- ✅ Project selector with localStorage persistence
- ✅ Project statistics (tasks, workflows)

### OAuth Integration Management
- ✅ Connect/disconnect OAuth providers
- ✅ Test connections with sample data
- ✅ View connection details (scopes, email, last refresh)
- ✅ Configure provider settings (file keys, slugs, repos)
- ✅ Automatic popup flow with polling (60s timeout)

### Dashboard
- ✅ Real-time statistics
- ✅ Quick navigation cards
- ✅ Project selector
- ✅ Email verification status

---

## Project Structure

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
│   │   ├── projects/
│   │   │   ├── index.vue    # Project list
│   │   │   ├── [id].vue     # Project detail
│   │   │   └── new.vue      # New project form
│   │   ├── forgot-password.vue
│   │   └── reset-password/
│   │       └── [token].vue
│   ├── stores/              # Pinia stores
│   │   ├── projects.ts      # Project CRUD & selection
│   │   └── integrations.ts  # OAuth management
│   └── app.vue              # Root component
├── public/                  # Static assets
├── nuxt.config.ts           # Nuxt configuration
├── tailwind.config.ts       # Tailwind configuration
└── package.json
```

---

## Key Components

### AppNavbar
Global navigation bar with project selector and user menu.

### ProjectSelector
Dropdown component for selecting the active project. Selected project is persisted in localStorage.

### IntegrationCard
Displays OAuth integration status with Connect/Test/Disconnect actions. Supports provider-specific configuration forms.

**Props:**
- `provider`: 'GITHUB' | 'LINEAR' | 'FIGMA' | 'SENTRY'

**Features:**
- Provider logo
- Status badge (connected/error/disconnected/not_configured)
- Connection details (scopes, email, last refresh)
- Connect/disconnect/test buttons
- Configuration slot for provider-specific settings

### StatusBadge
Visual status indicator with colored dot.

**Props:**
- `status`: 'connected' | 'error' | 'disconnected' | 'not_configured'

---

## State Management (Pinia)

### Projects Store (`stores/projects.ts`)

**State:**
- `projects: Project[]` - All user projects
- `selectedProjectId: string | null` - Currently selected project
- `loading: boolean`
- `error: string | null`

**Actions:**
- `fetchProjects()` - Load all user projects
- `selectProject(id)` - Select project and save to localStorage
- `restoreSelectedProject()` - Restore from localStorage
- `createProject(dto)` - Create new project
- `updateProject(id, dto)` - Update project
- `deleteProject(id)` - Delete project (soft delete)
- `linkRepository(id, url)` - Link GitHub repository
- `getProjectStatistics(id)` - Get project stats

### Integrations Store (`stores/integrations.ts`)

**State:**
- `connections: OAuthConnection[]` - Active OAuth connections
- `integrationConfig: ProjectIntegration | null` - Provider settings
- `testResults: Map<Provider, TestResult>` - Test results cache
- `oauthPopup: Window | null` - OAuth popup reference
- `oauthPolling: NodeJS.Timeout | null` - Polling interval

**Actions:**
- `fetchConnections(projectId)` - Load OAuth connections
- `fetchIntegrationConfig(projectId)` - Load provider settings
- `connectOAuth(projectId, provider)` - Open OAuth popup and poll
- `disconnectOAuth(projectId, provider)` - Revoke OAuth token
- `testConnection(projectId, provider)` - Test OAuth connection
- `updateIntegrationConfig(projectId, config)` - Save provider settings
- `clearTestResults()` - Clear test results cache

---

## OAuth Popup Flow

The web interface uses an automatic popup flow with polling for OAuth connections:

1. **Initiate:** Call `POST /auth/{provider}/authorize` to get authorization URL
2. **Open Popup:** Open authorization URL in popup window (600x700)
3. **Poll:** Poll `GET /auth/connections?project={id}` every 1 second
4. **Detect:** When connection appears with `isActive: true`, close popup
5. **Timeout:** If 60 seconds pass without connection, show error

**Implementation:**
```typescript
// stores/integrations.ts
const connectOAuth = async (projectId: string, provider: OAuthProvider) => {
  // Step 1: Get authorization URL
  const response = await apiFetch<{ authorizationUrl: string }>(
    `/auth/${provider.toLowerCase()}/authorize`,
    { method: 'POST', body: JSON.stringify({ projectId }) }
  )

  // Step 2: Open popup
  const popup = window.open(response.authorizationUrl, ...)

  // Step 3-4: Poll for connection
  await pollForConnection(projectId, provider)
}
```

---

## Authentication

### Session-Based Auth

The web interface uses session-based authentication with httpOnly cookies:

- Cookie name: `devflow_session`
- Storage: Redis (7-day TTL)
- Security: httpOnly, SameSite=Lax, Secure (production)

### Composable Usage

```typescript
// In any component
import { useAuth } from '@/composables/auth'

const { user, isAuthenticated, login, logout } = useAuth()

// Check if user is logged in
if (isAuthenticated.value) {
  console.log('User:', user.value)
}

// Login
await login({ email: 'user@example.com', password: 'password' })

// Logout
await logout()
```

### Protected Routes

```typescript
// pages/dashboard/index.vue
definePageMeta({
  middleware: 'auth', // Requires authentication
})
```

---

## API Integration

### API Wrapper

All API calls use the `apiFetch` wrapper which:
- Automatically includes credentials (session cookie)
- Handles errors and shows toast notifications
- Uses the configured API URL from environment

```typescript
// composables/api.ts
import { $fetch } from 'ofetch'

const API_URL = useRuntimeConfig().public.apiUrl

export const apiFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  return $fetch<T>(`${API_URL}${url}`, {
    ...options,
    credentials: 'include', // Include session cookie
  })
}
```

### Example Usage

```typescript
// Fetch projects
const projects = await apiFetch<Project[]>('/projects')

// Create project
const project = await apiFetch<Project>('/projects', {
  method: 'POST',
  body: JSON.stringify({ name: 'My Project' }),
})

// Connect OAuth
const { authorizationUrl } = await apiFetch<{ authorizationUrl: string }>(
  '/auth/github/authorize',
  { method: 'POST', body: JSON.stringify({ projectId: 'xxx' }) }
)
```

---

## Styling

The web interface uses Tailwind CSS with dark mode support.

### Dark Mode

Dark mode is controlled by the `dark:` variant in Tailwind:

```vue
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
  Light and dark mode!
</div>
```

### Theme Toggle

Dark mode toggle will be added in a future release. Currently, it follows the system preference.

---

## Troubleshooting

### Session Not Persisting

**Symptom:** Redirected to login page after successful login

**Fix:** Ensure `credentials: 'include'` is set in API calls:
```typescript
// composables/api.ts
credentials: 'include' // ← Must be present
```

### OAuth Popup Blocked

**Symptom:** Popup doesn't open when clicking "Connect"

**Fix:** Allow popups for `localhost:3001` in browser settings

### OAuth Polling Never Completes

**Symptom:** Popup stays open indefinitely

**Debug:**
1. Check API logs: `docker-compose logs -f api`
2. Manually verify connection: `curl http://localhost:3000/api/v1/auth/connections?project=xxx -H "Cookie: devflow_session=xxx"`

### Build Errors

**Symptom:** TypeScript errors during build

**Fix:**
```bash
# Clear Nuxt cache
rm -rf .nuxt

# Regenerate types
pnpm dev --clean
```

---

## Development Tips

### Hot Module Replacement

Nuxt supports HMR out of the box. Changes to Vue components will update instantly.

### Type Checking

```bash
# Run TypeScript type checking
pnpm typecheck
```

### Debugging

Add console logs in composables or components:

```typescript
// stores/projects.ts
const fetchProjects = async () => {
  console.log('[ProjectsStore] Fetching projects...')
  const data = await apiFetch<Project[]>('/projects')
  console.log('[ProjectsStore] Fetched:', data.length, 'projects')
  projects.value = data
}
```

### Browser DevTools

- **Vue DevTools:** Install browser extension for Vue component inspection
- **Network Tab:** Monitor API calls and responses
- **Application Tab:** Inspect localStorage and cookies

---

## Related Documentation

- [WEB_INTERFACE.md](../../.docs/WEB_INTERFACE.md) - Complete web interface documentation
- [ARCHITECTURE.md](../../.docs/ARCHITECTURE.md) - System architecture
- [OAUTH_MULTITENANT.md](../../.docs/OAUTH_MULTITENANT.md) - OAuth architecture
- [CLAUDE.md](../../CLAUDE.md) - AI agent context

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (port 3001) |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Lint code with ESLint |

---

**Maintainers:** DevFlow Team
**Status:** Production Ready
**Last Updated:** December 28, 2025
