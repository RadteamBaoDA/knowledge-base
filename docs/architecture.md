# Architecture

System architecture and design documentation for Knowledge Base.

## System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Users                                      │
│                    (Browser / Mobile Browser)                           │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Load Balancer / Nginx                           │
│                        (SSL Termination, Routing)                       │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
┌────────────────────────────┐   ┌────────────────────────────────────────┐
│       Frontend (FE)        │   │              Backend (BE)               │
│   React + Vite + Tailwind  │   │         Express + TypeScript            │
│        Port: 5173          │   │            Port: 3001                   │
│                            │   │                                         │
│  ┌──────────────────────┐  │   │  ┌─────────────────────────────────┐   │
│  │  Pages               │  │   │  │  Routes                         │   │
│  │  - AI Chat           │  │   │  │  - /api/auth/*                  │   │
│  │  - AI Search         │  │   │  │  - /api/users/*                 │   │
│  │  - History           │  │   │  │  - /api/ragflow/*               │   │
│  │  - User Management   │  │   │  │  - /api/minio/*                 │   │
│  │  - Storage Manager   │  │   │  │  - /api/storage/*               │   │
│  │  - System Tools      │  │   │  │  - /api/system-tools/*          │   │
│  └──────────────────────┘  │   │  └─────────────────────────────────┘   │
│                            │   │                                         │
│  ┌──────────────────────┐  │   │  ┌─────────────────────────────────┐   │
│  │  Components          │  │   │  │  Services                       │   │
│  │  - Layout            │  │   │  │  - AuthService                  │   │
│  │  - RagflowIframe     │  │   │  │  - UserService                  │   │
│  │  - SettingsDialog    │  │   │  │  - MinioService                 │   │
│  │  - Dialog, Select... │  │   │  │  - LangfuseService              │   │
│  └──────────────────────┘  │   │  └─────────────────────────────────┘   │
│                            │   │                                         │
│  ┌──────────────────────┐  │   │  ┌─────────────────────────────────┐   │
│  │  Contexts            │  │   │  │  Middleware                     │   │
│  │  - AuthContext       │  │   │  │  - requireAuth                  │   │
│  │  - SettingsContext   │  │   │  │  - requireRole                  │   │
│  │  - RagflowContext    │  │   │  │  - requirePermission            │   │
│  └──────────────────────┘  │   │  └─────────────────────────────────┘   │
└────────────────────────────┘   └────────────────────────────────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────┐
                 │                                │                        │
                 ▼                                ▼                        ▼
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│      PostgreSQL        │   │         Redis          │   │         MinIO          │
│    (Primary Database)  │   │    (Session Store)     │   │   (Object Storage)     │
│                        │   │                        │   │                        │
│  - users               │   │  - Session data        │   │  - Documents           │
│  - minio_buckets       │   │  - Cache (future)      │   │  - Images              │
│  - chat_history        │   │                        │   │  - Files               │
└────────────────────────┘   └────────────────────────┘   └────────────────────────┘
                                                                     │
                 ┌───────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            RAGFlow Server                               │
│                      (AI Chat & Search Engine)                          │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Chat Interface │  │ Search Interface│  │  Knowledge Base Docs    │ │
│  │  (iframe embed) │  │  (iframe embed) │  │  (indexed content)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            Langfuse                                     │
│                    (AI Observability Platform)                          │
│                                                                         │
│  - Trace AI interactions                                                │
│  - Monitor token usage                                                  │
│  - Debug conversation flows                                             │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (React + Vite)

| Layer | Purpose |
|-------|---------|
| **Pages** | Route-level components (AiChatPage, LoginPage, etc.) |
| **Components** | Reusable UI components (Layout, Dialog, Select, etc.) |
| **Contexts** | Global state management (Auth, Settings, Ragflow) |
| **Hooks** | Custom React hooks (useAuth, useSharedUser) |
| **Services** | API client functions (minioService, userPreferences) |

### Backend (Express + TypeScript)

| Layer | Purpose |
|-------|---------|
| **Routes** | HTTP endpoint handlers |
| **Services** | Business logic (stateless) |
| **Middleware** | Request processing (auth, permissions) |
| **Config** | Environment & app configuration |
| **DB** | Database abstraction layer |

## Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │ Frontend │     │ Backend  │     │ Azure AD │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  Click Login   │                │                │
     │───────────────>│                │                │
     │                │  GET /login    │                │
     │                │───────────────>│                │
     │                │                │  Redirect      │
     │                │<───────────────│───────────────>│
     │                │                │                │
     │                │    Microsoft Login Page         │
     │<────────────────────────────────────────────────>│
     │                │                │                │
     │                │                │   Callback     │
     │                │                │<───────────────│
     │                │                │                │
     │                │  Set Session   │                │
     │                │<───────────────│                │
     │                │                │                │
     │  Redirect Home │                │                │
     │<───────────────│                │                │
     │                │                │                │
```

## Data Flow

### RAGFlow Iframe Integration

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Backend   │     │   RAGFlow   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ GET /ragflow/config                   │
       │──────────────────>│                   │
       │                   │                   │
       │ { chatUrl, searchUrl }                │
       │<──────────────────│                   │
       │                   │                   │
       │ Load iframe with URL                  │
       │──────────────────────────────────────>│
       │                   │                   │
       │        RAGFlow UI (chat/search)       │
       │<──────────────────────────────────────│
       │                   │                   │
```

### File Upload Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Backend   │     │    MinIO    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ POST /upload (multipart)              │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ putObject()       │
       │                   │──────────────────>│
       │                   │                   │
       │                   │     OK            │
       │                   │<──────────────────│
       │                   │                   │
       │   { success }     │                   │
       │<──────────────────│                   │
       │                   │                   │
```

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255),
  avatar        TEXT,
  role          VARCHAR(50) DEFAULT 'user',
  department    VARCHAR(255),
  job_title     VARCHAR(255),
  mobile_phone  VARCHAR(50),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

### MinIO Buckets Table

```sql
CREATE TABLE minio_buckets (
  id            UUID PRIMARY KEY,
  bucket_name   VARCHAR(255) UNIQUE NOT NULL,
  display_name  VARCHAR(255),
  description   TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);
```

## Role-Based Access Control (RBAC)

### Roles & Permissions

| Permission | Admin | Manager | User |
|------------|:-----:|:-------:|:----:|
| `view_chat` | ✅ | ✅ | ✅ |
| `view_search` | ✅ | ✅ | ✅ |
| `view_history` | ✅ | ✅ | ✅ |
| `manage_storage` | ✅ | ✅ | ❌ |
| `manage_users` | ✅ | ❌ | ❌ |
| `view_system_tools` | ✅ | ❌ | ❌ |
| `manage_buckets` | ✅ | ❌ | ❌ |

### Middleware Chain

```typescript
// Example: Storage route protection
router.use(requireAuth);                    // Must be logged in
router.use(requireRole(['admin', 'manager'])); // Must have role
router.use(requirePermission('manage_storage')); // Must have permission
```

## Security Considerations

1. **Session Security**
   - HTTP-only cookies
   - Secure flag in production
   - Redis session store with TTL

2. **CORS**
   - Restricted to `FRONTEND_URL`
   - Credentials included

3. **Input Validation**
   - Request body validation
   - SQL injection prevention via parameterized queries

4. **File Upload**
   - File type validation
   - Size limits
   - Secure MinIO presigned URLs
