# Knowledge Base

RAGFlow knowledge-base proxy that embeds AI Chat and AI Search interfaces via iframe, with Langfuse logging for observability, PostgreSQL chat history, and Azure Entra ID authentication.

## Quick Start

```bash
# Install all dependencies
npm install

# Create environment file from example
cp be/.env.example be/.env

# Set up PostgreSQL database and run migrations
npm run db:migrate -w be

# Run both frontend and backend in development mode
npm run dev
```

## Project Structure

```
├── be/                 # Backend: Express + TypeScript (Port 3001)
│   └── src/
│       ├── config/     # Centralized config via `config` object
│       ├── db/         # PostgreSQL connection pool + migrations
│       ├── middleware/ # Auth: `requireAuth` + mock user in dev
│       ├── routes/     # Express Router pattern: *.routes.ts
│       │   ├── auth.routes.ts    # Azure Entra ID OAuth2 flow
│       │   ├── chat.routes.ts    # Chat sessions & messages CRUD
│       │   └── search.routes.ts  # Search logging
│       └── services/   # Stateless functions: *.service.ts
│           ├── auth.service.ts      # Azure AD OAuth2 helpers
│           ├── history.service.ts   # PostgreSQL chat history
│           └── langfuse.service.ts  # Langfuse logging
├── fe/                 # Frontend: React + Vite + Tailwind (Port 5173)
│   └── src/
│       ├── components/
│       │   ├── Layout.tsx        # Collapsible sidebar + user info
│       │   └── RagflowIframe.tsx # Iframe wrapper for RAGFlow
│       └── pages/
│           ├── AiChatPage.tsx    # AI Chat interface
│           ├── AiSearchPage.tsx  # AI Search interface
│           ├── HistoryPage.tsx   # Chat history with search/delete
│           ├── LoginPage.tsx     # Microsoft SSO login
│           └── LogoutPage.tsx    # Logout handler
└── package.json        # Root workspace configuration (npm workspaces)
```

## Features

- **AI Chat Proxy**: Embed RAGFlow chat interface with conversation logging
- **AI Search Proxy**: Embed RAGFlow search interface with query logging
- **Langfuse Integration**: Full observability - log all user prompts and AI responses
- **PostgreSQL Chat History**: Persistent storage with full-text search via GIN indexes
- **Azure Entra ID SSO**: Microsoft OAuth2 authentication with user avatar support
- **Role-Based Access Control (RBAC)**: Granular permissions for Admin, Manager, and User roles
- **Root Login**: Built-in root user for initial setup and emergency access
- **Collapsible Sidebar**: Responsive UI with user info display

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
- `GET /api/auth/login` - Redirect to Azure Entra ID login
- `GET /api/auth/callback` - OAuth2 callback handler
- `GET /api/auth/logout` - Logout and redirect to Azure logout
- `GET /api/auth/me` - Get current authenticated user

### Chat History
- `GET /api/chat/sessions` - List user's chat sessions
- `GET /api/chat/sessions/search` - Search sessions with filters
- `POST /api/chat/sessions` - Create new session
- `DELETE /api/chat/sessions/:id` - Delete a session
- `DELETE /api/chat/sessions` - Bulk delete sessions

### RAGFlow Config
### RAGFlow Config
- `GET /api/ragflow/config` - Get iframe URLs for AI Chat/Search (Requires `view_chat` permission)

### User Management (Admin Only)
- `GET /api/users` - List all users
- `PUT /api/users/:id/role` - Update user role

## Environment Variables

Create `be/.env` from `be/.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development

# PostgreSQL Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=knowledge_base
DB_USER=postgres
DB_PASSWORD=your-password

# RAGFlow iframe URLs
RAGFLOW_AI_CHAT=http://your-ragflow-server/chat
RAGFLOW_AI_SEARCH=http://your-ragflow-server/search

# Langfuse (observability)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx

# Azure Entra ID (Microsoft SSO)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_REDIRECT_URI=http://localhost:3001/api/auth/callback

# Session
SESSION_SECRET=your-session-secret

# Frontend URL (for CORS)
# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Root Login (Optional)
ENABLE_ROOT_LOGIN=true
KB_ROOT_USER=admin@localhost
KB_ROOT_PASSWORD=admin
```

## Azure App Registration Setup

1. Go to Azure Portal → Microsoft Entra ID → App registrations
2. Create new registration
3. Add redirect URI: `http://localhost:3001/api/auth/callback` (Web platform)
4. Create a client secret
5. Add API permissions: `openid`, `profile`, `email`, `User.Read`
6. Copy Client ID, Client Secret, and Tenant ID to `.env`

## License

MIT
