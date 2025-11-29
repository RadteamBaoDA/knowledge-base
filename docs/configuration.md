# Configuration Guide

Complete configuration reference for Knowledge Base.

## Environment Variables

Create `be/.env` from `be/.env.example`.

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment: `development` \| `production` |
| `LOG_LEVEL` | `debug` | Logging level: `error` \| `warn` \| `info` \| `debug` |

### Development Server

| Variable | Default | Description |
|----------|---------|-------------|
| `DEV_DOMAIN` | `localhost` | Development domain |
| `DEV_PORT` | `5173` | Frontend dev server port |
| `HTTPS_ENABLED` | `false` | Enable HTTPS for local dev |
| `DEV_ADDITIONAL_DOMAINS` | - | Additional SSL domains (comma-separated) |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_TYPE` | `postgresql` | Database type: `postgresql` \| `sqlite` |

#### PostgreSQL (when `DATABASE_TYPE=postgresql`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `knowledge_base` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | - | Database password |

#### SQLite (when `DATABASE_TYPE=sqlite`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SQLITE_PATH` | `.data/knowledge-base.db` | SQLite file path |

### Session Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_STORE` | `redis` | Session store: `redis` \| `memory` |
| `SESSION_SECRET` | - | **Required.** Session encryption secret |
| `SESSION_TTL_DAYS` | `7` | Session expiry in days |

#### Redis (when `SESSION_STORE=redis`)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password (optional) |
| `REDIS_DB` | `0` | Redis database number |

### Azure Entra ID (Microsoft SSO)

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_AD_CLIENT_ID` | Yes | Application (client) ID |
| `AZURE_AD_CLIENT_SECRET` | Yes | Client secret value |
| `AZURE_AD_TENANT_ID` | Yes | Directory (tenant) ID |
| `AZURE_AD_REDIRECT_URI` | Yes | OAuth callback URL |

### RAGFlow Configuration

| Variable | Description |
|----------|-------------|
| `RAGFLOW_AI_CHAT_URL` | Full URL for AI Chat iframe |
| `RAGFLOW_AI_SEARCH_URL` | Full URL for AI Search iframe |

**URL Format:**
```
http://ragflow-server:8888/next-chats/share?shared_id=YOUR_ID&from=chat&auth=TOKEN
```

### MinIO Object Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `localhost` | MinIO server endpoint |
| `MINIO_PORT` | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access key |
| `MINIO_SECRET_KEY` | `minioadmin` | Secret key |
| `MINIO_USE_SSL` | `false` | Use HTTPS |

### Langfuse (Observability)

| Variable | Description |
|----------|-------------|
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |
| `LANGFUSE_BASE_URL` | Langfuse server URL |

### Root Login (Development/Emergency)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_ROOT_LOGIN` | `false` | Enable root user login |
| `KB_ROOT_USER` | - | Root username (email format) |
| `KB_ROOT_PASSWORD` | - | Root password |

### Other Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `SHARED_STORAGE_DOMAIN` | `.localhost` | Domain for cross-subdomain auth |
| `ADMIN_API_KEY` | - | API key for admin operations |

## Azure App Registration Setup

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
3. Configure:
   - Name: `Knowledge Base`
   - Supported account types: Single tenant (or as needed)
   - Redirect URI: `http://localhost:3001/api/auth/callback` (Web)
4. After creation, note the **Application (client) ID**
5. Go to **Certificates & secrets** → **New client secret**
6. Copy the secret value immediately
7. Go to **API permissions** → **Add a permission**:
   - Microsoft Graph → Delegated permissions
   - Add: `openid`, `profile`, `email`, `User.Read`
8. Update `.env` with collected values

## RAGFlow Setup

1. Deploy RAGFlow server
2. Create a chat/search share in RAGFlow admin
3. Copy the share URL with authentication token
4. Set `RAGFLOW_AI_CHAT_URL` and `RAGFLOW_AI_SEARCH_URL`

## Multiple RAGFlow Sources

Configure multiple sources in `be/src/config/ragflow-sources.json`:

```json
{
  "chatSources": [
    {
      "id": "general",
      "name": "General Knowledge",
      "url": "http://ragflow:8888/chat?id=general"
    },
    {
      "id": "technical",
      "name": "Technical Docs",
      "url": "http://ragflow:8888/chat?id=technical"
    }
  ],
  "searchSources": [
    {
      "id": "all",
      "name": "All Documents",
      "url": "http://ragflow:8888/search?id=all"
    }
  ]
}
```
