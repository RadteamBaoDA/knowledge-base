# Development Guide

Developer setup and guidelines for Knowledge Base.

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| npm | 9+ |
| PostgreSQL | 14+ (or SQLite for dev) |
| Redis | 7+ (optional for dev) |

## Quick Setup

```bash
# Clone repository
git clone https://github.com/user/knowledge-base.git
cd knowledge-base

# Install dependencies (all workspaces)
npm install

# Setup environment
cp be/.env.example be/.env
# Edit be/.env with your settings

# Run database migrations
npm run db:migrate -w be

# Start development servers
npm run dev
```

## Project Structure

```
knowledge-base/
├── be/                     # Backend workspace
│   ├── src/
│   │   ├── config/         # Configuration
│   │   │   ├── index.ts    # Environment config
│   │   │   ├── rbac.ts     # Role permissions
│   │   │   └── system-tools.config.json
│   │   ├── db/
│   │   │   ├── index.ts    # DB connection
│   │   │   ├── adapters/   # PostgreSQL/SQLite adapters
│   │   │   └── migrations/ # Database migrations
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts
│   │   ├── models/         # Data models
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── scripts/        # Utility scripts
│   ├── public/             # Static files
│   ├── package.json
│   └── tsconfig.json
├── fe/                     # Frontend workspace
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API clients
│   │   ├── i18n/           # Internationalization
│   │   ├── lib/            # Utilities
│   │   ├── App.tsx         # Root component
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── docs/                   # Documentation
├── scripts/                # Build scripts
└── package.json            # Root workspace config
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start FE (5173) + BE (3001) |
| `npm run dev:fe` | Frontend only |
| `npm run dev:be` | Backend only |
| `npm run build` | Build all workspaces |
| `npm run build -w fe` | Build frontend only |
| `npm run build -w be` | Build backend only |
| `npm run db:migrate -w be` | Run migrations |
| `npm run lint` | Lint all workspaces |

## Backend Development

### Adding a New Route

1. Create route file in `be/src/routes/`:

```typescript
// be/src/routes/example.routes.ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware
router.use(requireAuth);

// GET /api/example
router.get('/', async (req, res) => {
  res.json({ message: 'Hello' });
});

// POST /api/example (admin only)
router.post('/', requireRole(['admin']), async (req, res) => {
  // ...
});

export default router;
```

2. Register in `be/src/index.ts`:

```typescript
import exampleRoutes from './routes/example.routes';

app.use('/api/example', exampleRoutes);
```

### Adding a New Service

```typescript
// be/src/services/example.service.ts
import { db } from '../db';
import { logger } from './logger.service';

export async function getItems(): Promise<Item[]> {
  try {
    const result = await db.query('SELECT * FROM items');
    return result.rows;
  } catch (error) {
    logger.error('Failed to get items', { error });
    throw error;
  }
}

export async function createItem(data: CreateItemDto): Promise<Item> {
  // ...
}
```

### Adding a Migration

1. Create migration file:

```typescript
// be/src/db/migrations/005_add_example_table.ts
import { Migration } from './types';

export const migration: Migration = {
  id: '005_add_example_table',
  
  async up(db) {
    await db.query(`
      CREATE TABLE IF NOT EXISTS examples (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },
  
  async down(db) {
    await db.query('DROP TABLE IF EXISTS examples');
  }
};
```

2. Register in `be/src/db/migrations/runner.ts`

3. Run: `npm run db:migrate -w be`

### Environment Configuration

Access config via the `config` object:

```typescript
import { config } from '../config';

console.log(config.port);           // 3001
console.log(config.db.host);        // localhost
console.log(config.azure.clientId); // your-client-id
```

## Frontend Development

### Adding a New Page

1. Create page component:

```tsx
// fe/src/pages/ExamplePage.tsx
import { useTranslation } from 'react-i18next';

function ExamplePage() {
  const { t } = useTranslation();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{t('example.title')}</h1>
    </div>
  );
}

export default ExamplePage;
```

2. Add route in `fe/src/App.tsx`:

```tsx
const ExamplePage = lazy(() => import('./pages/ExamplePage'));

// In routes
<Route path="/example" element={<ExamplePage />} />
```

3. Add to sidebar in `fe/src/components/Layout.tsx`

### Adding a New Component

```tsx
// fe/src/components/ExampleCard.tsx
interface ExampleCardProps {
  title: string;
  description: string;
  onClick?: () => void;
}

export function ExampleCard({ title, description, onClick }: ExampleCardProps) {
  return (
    <div 
      onClick={onClick}
      className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
    >
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
```

### Using API Client

```tsx
import { apiFetch } from '../lib/api';

// In component
const fetchData = async () => {
  try {
    const data = await apiFetch<MyData[]>('/api/example');
    setData(data);
  } catch (error) {
    console.error('Failed to fetch:', error);
  }
};

// With React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['example'],
  queryFn: () => apiFetch<MyData[]>('/api/example'),
});
```

### Adding Translations

1. Add to locale files:

```json
// fe/src/i18n/locales/en.json
{
  "example": {
    "title": "Example Page",
    "description": "This is an example"
  }
}
```

2. Use in component:

```tsx
const { t } = useTranslation();
<h1>{t('example.title')}</h1>
```

## Code Style Guidelines

### TypeScript

- Use strict mode
- Prefer `interface` over `type` for objects
- Use `async/await` over `.then()`
- Handle all errors explicitly

### React

- Use functional components with hooks
- Prefer composition over inheritance
- Use React Query for server state
- Use Context for global UI state

### CSS (Tailwind)

- Use Tailwind utility classes
- Support dark mode with `dark:` prefix
- Use `@apply` sparingly in `index.css`

## Testing

```bash
# Run tests (when available)
npm test

# Run tests with coverage
npm test -- --coverage
```

## Debugging

### Backend

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev:be

# View logs
# Logs are written to console with Winston
```

### Frontend

- Use React DevTools browser extension
- Use React Query DevTools (enabled in dev)
- Check browser console for errors

## Common Issues

| Issue | Solution |
|-------|----------|
| `Module not found` | Run `npm install` |
| Port already in use | Kill process or change port |
| Database connection failed | Check DB_* env vars |
| CORS errors | Verify `FRONTEND_URL` matches |
| Session not persisting | Check `SESSION_SECRET` is set |

## Git Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Push and create Pull Request
4. Get review and merge

### Commit Message Format

```
type(scope): description

- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code refactoring
- test: Tests
- chore: Maintenance
```

Example: `feat(auth): add root login support`
