# Knowledge Base

RAGFlow knowledge-base proxy that embeds AI Chat and AI Search interfaces via iframe, with Langfuse logging for observability, PostgreSQL/SQLite database support, MinIO object storage, and Azure Entra ID authentication.

## Quick Start

```bash
# Install all dependencies
npm install

# Create environment file from example
cp be/.env.example be/.env

# Set up database and run migrations
npm run db:migrate -w be

# Run both frontend and backend in development mode
npm run dev
```

## Project Structure

```
├── be/                 # Backend: Express + TypeScript (Port 3001)
│   └── src/
│       ├── config/     # Centralized config + RBAC permissions
│       │   ├── index.ts          # Environment config via `config` object
│       │   ├── rbac.ts           # Role-based access control definitions
│       │   └── system-tools.config.json  # System monitoring tools config
│       ├── db/         # Database abstraction layer
│       │   ├── adapters/         # PostgreSQL & SQLite adapters
│       │   └── migrations/       # Database migrations
│       ├── middleware/ # Express middleware
│       │   └── auth.middleware.ts  # Auth + permission checks
│       ├── models/     # Database models
│       │   └── minio-bucket.model.ts
│       ├── routes/     # Express Router pattern: *.routes.ts
│       │   ├── admin.routes.ts       # Admin operations
│       │   ├── auth.routes.ts        # Azure AD OAuth2 + root login
│       │   ├── minio-bucket.routes.ts    # Bucket management
│       │   ├── minio-storage.routes.ts   # File operations
│       │   ├── ragflow.routes.ts     # RAGFlow iframe config
│       │   ├── system-tools.routes.ts    # System monitoring tools
│       │   └── user.routes.ts        # User management
│       ├── services/   # Stateless business logic
│       │   ├── auth.service.ts       # Azure AD OAuth2 helpers
│       │   ├── langfuse.service.ts   # Langfuse observability
│       │   ├── logger.service.ts     # Winston logging
│       │   ├── minio.service.ts      # MinIO object storage
│       │   ├── system-tools.service.ts   # System tools config
│       │   └── user.service.ts       # User CRUD operations
│       └── scripts/    # Utility scripts
│           └── migrate.ts            # Migration runner
├── fe/                 # Frontend: React + Vite + Tailwind (Port 5173)
│   └── src/
│       ├── components/ # Reusable UI components
│       │   ├── Layout.tsx        # Main layout with collapsible sidebar
│       │   ├── ProtectedRoute.tsx    # Auth-protected route wrapper
│       │   ├── AdminRoute.tsx    # Admin-only route wrapper
│       │   ├── RoleRoute.tsx     # Role-based route wrapper
│       │   ├── RagflowIframe.tsx # RAGFlow iframe with error handling
│       │   ├── SettingsDialog.tsx    # Theme/language settings
│       │   ├── SystemToolCard.tsx    # Tool card for admin dashboard
│       │   ├── Dialog.tsx        # Reusable modal dialog
│       │   ├── Select.tsx        # Custom dropdown component
│       │   ├── RadioGroup.tsx    # Radio button group
│       │   └── Checkbox.tsx      # Accessible checkbox
│       ├── contexts/   # React Context providers
│       │   ├── SettingsContext.tsx   # Theme & language state
│       │   └── RagflowContext.tsx    # RAGFlow source config
│       ├── hooks/      # Custom React hooks
│       │   ├── useAuth.tsx       # Authentication hook
│       │   └── useSharedUser.ts  # Cross-subdomain user sharing
│       ├── services/   # API client services
│       │   ├── minioService.ts   # MinIO API client
│       │   ├── systemToolsService.ts # System tools API
│       │   ├── userPreferences.ts    # IndexedDB preferences
│       │   └── shared-storage.service.ts # Cross-subdomain storage
│       ├── i18n/       # Internationalization
│       │   └── locales/          # en.json, ja.json, vi.json
│       ├── pages/      # Route page components
│       │   ├── AiChatPage.tsx    # AI Chat interface
│       │   ├── AiSearchPage.tsx  # AI Search interface
│       │   ├── HistoryPage.tsx   # Chat history with search
│       │   ├── LoginPage.tsx     # Microsoft SSO + root login
│       │   ├── LogoutPage.tsx    # Logout handler
│       │   ├── ErrorPage.tsx     # Error display (403/404/500)
│       │   ├── UserManagementPage.tsx  # Admin user management
│       │   ├── SystemToolsPage.tsx     # System monitoring tools
│       │   └── MinIOManagerPage.tsx    # File storage manager
│       └── lib/        # Utility libraries
│           └── api.ts            # API fetch wrapper
├── scripts/            # Build/dev scripts
│   └── generate-cert.js          # SSL certificate generator
└── package.json        # Root workspace configuration (npm workspaces)
```

## Features

- **AI Chat Proxy**: Embed RAGFlow chat interface with multiple source support
- **AI Search Proxy**: Embed RAGFlow search interface with multiple source support
- **Langfuse Integration**: Full observability - log all user prompts and AI responses
- **Dual Database Support**: PostgreSQL (production) or SQLite (development)
- **MinIO Object Storage**: File upload, download, and bucket management
- **Azure Entra ID SSO**: Microsoft OAuth2 authentication with user avatar
- **Role-Based Access Control (RBAC)**: Admin, Manager, and User roles with granular permissions
- **Root Login**: Built-in root user for initial setup and emergency access
- **System Monitoring Tools**: Admin dashboard with configurable external tool links
- **Internationalization**: Support for English, Japanese, and Vietnamese
- **Theme Support**: Light, Dark, and System theme preferences
- **Collapsible Sidebar**: Responsive UI with user info display
- **Cross-Subdomain Auth**: Share authentication across subdomains

## Development Commands

```bash
npm install              # Install all workspaces
npm run dev              # Run BE (3001) + FE (5173) concurrently
npm run dev:be           # Backend only with tsx watch
npm run dev:fe           # Frontend only with Vite
npm run db:migrate -w be # Run database migrations
npm run build            # Build all workspaces
npm run lint             # Lint all workspaces
```

## API Endpoints

### Authentication
- `GET /api/auth/config` - Get auth configuration (root login enabled, etc.)
- `GET /api/auth/login` - Redirect to Azure Entra ID login
- `GET /api/auth/callback` - OAuth2 callback handler
- `POST /api/auth/login/root` - Root user login (when enabled)
- `GET /api/auth/logout` - Logout and redirect to Azure logout
- `GET /api/auth/me` - Get current authenticated user

### RAGFlow Config
- `GET /api/ragflow/config` - Get iframe URLs and sources for AI Chat/Search

### User Management (Admin Only)
- `GET /api/users` - List all users
- `PUT /api/users/:id/role` - Update user role

### MinIO Storage (Admin/Manager)
- `GET /api/minio/buckets` - List all buckets
- `POST /api/minio/buckets` - Create a new bucket
- `DELETE /api/minio/buckets/:id` - Delete a bucket
- `GET /api/storage/:bucketId/objects` - List objects in bucket
- `POST /api/storage/:bucketId/upload` - Upload files
- `DELETE /api/storage/:bucketId/objects` - Delete object(s)
- `GET /api/storage/:bucketId/download` - Get download URL

### System Tools (Admin Only)
- `GET /api/system-tools` - Get configured system monitoring tools

## Environment Variables

Create `be/.env` from `be/.env.example`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# Development Server Configuration
DEV_DOMAIN=localhost
DEV_PORT=5173

# HTTPS Configuration (optional)
HTTPS_ENABLED=false
DEV_ADDITIONAL_DOMAINS=kb

# Database Configuration
# Options: postgresql | sqlite
DATABASE_TYPE=postgresql

# PostgreSQL (when DATABASE_TYPE=postgresql)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=knowledge_base
DB_USER=postgres
DB_PASSWORD=your-password

# SQLite (when DATABASE_TYPE=sqlite)
SQLITE_PATH=.data/knowledge-base.db

# Session Store Configuration
# Options: redis | memory
SESSION_STORE=redis

# Redis Configuration (when SESSION_STORE=redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Session Configuration
SESSION_SECRET=your-session-secret
SESSION_TTL_DAYS=7

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Shared Storage Domain (for cross-subdomain auth)
SHARED_STORAGE_DOMAIN=.localhost

# RAGFlow iframe URLs
RAGFLOW_AI_CHAT_URL=http://localhost:8888/next-chats/share?shared_id=YOUR_ID
RAGFLOW_AI_SEARCH_URL=http://localhost:8888/next-search/share?shared_id=YOUR_ID

# Langfuse (observability)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Azure Entra ID (Microsoft SSO)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_REDIRECT_URI=http://localhost:3001/api/auth/callback

# Admin API Key
ADMIN_API_KEY=change-me-in-production

# Root Login (Optional)
ENABLE_ROOT_LOGIN=true
KB_ROOT_USER=admin@localhost
KB_ROOT_PASSWORD=admin

# MinIO Object Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
```

## Azure App Registration Setup

1. Go to Azure Portal → Microsoft Entra ID → App registrations
2. Create new registration
3. Add redirect URI: `http://localhost:3001/api/auth/callback` (Web platform)
4. Create a client secret
5. Add API permissions: `openid`, `profile`, `email`, `User.Read`
6. Copy Client ID, Client Secret, and Tenant ID to `.env`

## Role-Based Access Control

| Role    | Permissions                                                    |
|---------|----------------------------------------------------------------|
| Admin   | Full access: user management, system tools, storage, all views |
| Manager | Storage management, AI chat, AI search, history                |
| User    | AI chat, AI search, history (own data only)                    |

## System Monitoring Tools Configuration

Admin users can access external monitoring tools configured in `be/src/config/system-tools.config.json`:

```json
{
  "tools": [
    {
      "id": "grafana",
      "name": "Grafana",
      "description": "Metrics and dashboards",
      "url": "http://localhost:3000",
      "icon": "/static/icons/grafana.svg"
    }
  ]
}
```

## License

MIT
