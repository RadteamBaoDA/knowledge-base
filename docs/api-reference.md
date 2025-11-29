# API Reference

REST API documentation for Knowledge Base backend.

## Base URL

- Development: `http://localhost:3001/api`
- Production: `https://your-domain.com/api`

## Authentication

All endpoints (except auth endpoints) require authentication via session cookie.

---

## Auth Endpoints

### Get Auth Configuration

```http
GET /api/auth/config
```

**Response:**
```json
{
  "enableRootLogin": true,
  "azureAdEnabled": true
}
```

### Azure AD Login

```http
GET /api/auth/login?redirect={url}
```

Redirects to Microsoft login page.

| Parameter | Type | Description |
|-----------|------|-------------|
| `redirect` | query | URL to redirect after login |

### OAuth Callback

```http
GET /api/auth/callback
```

Handles OAuth2 callback from Azure AD. Creates session and redirects to frontend.

### Root Login

```http
POST /api/auth/login/root
Content-Type: application/json
```

**Request:**
```json
{
  "username": "admin@localhost",
  "password": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "root",
    "email": "admin@localhost",
    "displayName": "Root Admin",
    "role": "admin"
  }
}
```

### Get Current User

```http
GET /api/auth/me
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@company.com",
  "displayName": "John Doe",
  "avatar": "https://...",
  "role": "admin",
  "department": "Engineering",
  "job_title": "Developer"
}
```

### Logout

```http
GET /api/auth/logout
```

Clears session and redirects to Azure AD logout.

---

## User Management

*Requires `admin` role.*

### List Users

```http
GET /api/users
```

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@company.com",
    "displayName": "John Doe",
    "role": "user",
    "department": "Engineering",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Update User Role

```http
PUT /api/users/:id/role
Content-Type: application/json
```

**Request:**
```json
{
  "role": "manager"
}
```

| Role | Description |
|------|-------------|
| `admin` | Full access |
| `manager` | Storage + views |
| `user` | Basic access |

---

## RAGFlow Configuration

### Get RAGFlow Config

```http
GET /api/ragflow/config
```

**Response:**
```json
{
  "aiChatUrl": "http://ragflow:8888/chat",
  "aiSearchUrl": "http://ragflow:8888/search",
  "chatSources": [
    { "id": "general", "name": "General", "url": "..." }
  ],
  "searchSources": [
    { "id": "all", "name": "All", "url": "..." }
  ]
}
```

---

## MinIO Buckets

*Requires `admin` or `manager` role.*

### List Buckets

```http
GET /api/minio/buckets
```

**Response:**
```json
[
  {
    "id": "uuid",
    "bucket_name": "documents",
    "display_name": "Documents",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Create Bucket

```http
POST /api/minio/buckets
Content-Type: application/json
```

**Request:**
```json
{
  "bucketName": "my-bucket",
  "displayName": "My Bucket"
}
```

### Delete Bucket

```http
DELETE /api/minio/buckets/:id
```

*Requires `admin` role.*

---

## MinIO Storage

*Requires `admin` or `manager` role.*

### List Objects

```http
GET /api/storage/:bucketId/objects?prefix={path}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `prefix` | query | Folder path (optional) |

**Response:**
```json
[
  {
    "name": "file.pdf",
    "size": 1024,
    "lastModified": "2024-01-01T00:00:00Z",
    "isFolder": false
  },
  {
    "name": "folder/",
    "isFolder": true,
    "prefix": "folder/"
  }
]
```

### Upload Files

```http
POST /api/storage/:bucketId/upload
Content-Type: multipart/form-data
```

| Field | Type | Description |
|-------|------|-------------|
| `files` | file[] | Files to upload |
| `prefix` | string | Target folder path |

### Delete Object

```http
DELETE /api/storage/:bucketId/objects
Content-Type: application/json
```

**Request:**
```json
{
  "objects": [
    { "name": "file.pdf", "isFolder": false },
    { "name": "folder/", "isFolder": true }
  ]
}
```

### Get Download URL

```http
GET /api/storage/:bucketId/download?path={filePath}
```

**Response:**
```json
{
  "url": "http://minio:9000/bucket/file.pdf?token=..."
}
```

---

## System Tools

*Requires `admin` role.*

### Get System Tools

```http
GET /api/system-tools
```

**Response:**
```json
[
  {
    "id": "grafana",
    "name": "Grafana",
    "description": "Metrics dashboard",
    "url": "http://grafana:3000",
    "icon": "/static/icons/grafana.svg"
  }
]
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Not authenticated |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |
