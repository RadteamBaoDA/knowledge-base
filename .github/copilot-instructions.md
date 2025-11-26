# Copilot Instructions for knowledge-base

## Project Overview

RAGFlow knowledge-base proxy that embeds AI Chat and AI Search interfaces via iframe, with Langfuse logging for observability and chat history tracking.

## Architecture

### Monorepo Structure (npm workspaces)
```
├── be/                 # Backend: Express + TypeScript (Port 3001)
│   └── src/
│       ├── config/     # Centralized config via `config` object
│       ├── middleware/ # Auth: `requireAuth` + mock user in dev
│       ├── routes/     # Express Router pattern: *.routes.ts
│       └── services/   # Stateless functions: *.service.ts
├── fe/                 # Frontend: React + Vite + Tailwind (Port 5173)
│   └── src/
│       ├── components/ # Layout, RagflowIframe
│       └── pages/      # Route components
└── package.json        # Root workspace scripts
```

### Key Integration Points
- **RAGFlow**: Iframe URLs served from `/api/ragflow/config` → fetched by `RagflowIframe.tsx`
- **Langfuse 3.x**: `logChatInteraction()` / `logSearchInteraction()` in `langfuse.service.ts`
- **Azure AD SSO**: `passport-azure-ad` (auth middleware auto-mocks user in development)

## Development Commands

```bash
npm install              # Install all workspaces
npm run dev              # Run BE (3001) + FE (5173) concurrently
npm run dev:be           # Backend only with tsx watch
npm run dev:fe           # Frontend only with Vite
npm run build            # Build all workspaces
```

## Code Conventions

### TypeScript (Strict Mode)
- Access env via `config` object from `be/src/config/index.ts` - never raw `process.env`
- Use `noUncheckedIndexedAccess` - always handle `undefined` for array/object access
- All API responses typed with explicit interfaces

### Backend Patterns
```typescript
// Routes: be/src/routes/*.routes.ts
router.use(requireAuth);  // Apply auth middleware
const user = getCurrentUser(req);  // Get typed user

// Services: stateless, async functions
await logChatInteraction({ userId, sessionId, traceId, userPrompt, aiResponse });
```

### Frontend Patterns
```typescript
// Data fetching: React Query with typed fetchers
const { data, isLoading } = useQuery({ queryKey: ['key'], queryFn: fetchFn });

// Styling: Tailwind classes, custom colors in tailwind.config.js
className="w-full h-[calc(100vh-140px)] border border-slate-200"
```

## Environment Setup

Copy `.env.example` in `be/` directory. Key variables:
- `RAGFLOW_AI_CHAT`, `RAGFLOW_AI_SEARCH` - Full iframe URLs
- `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY` - Langfuse 3.x credentials
- `AZURE_AD_*` - SSO config (dev mode auto-uses mock user)

---

