# Knowledge Base

RAGFlow knowledge-base proxy with Langfuse logging for AI Chat and AI Search.

## Quick Start

```bash
# Install all dependencies
npm install

# Create environment files from examples
cp be/.env.example be/.env
cp fe/.env.example fe/.env

# Run both frontend and backend in development mode
npm run dev
```

## Project Structure

```
├── be/                 # Backend (Express + TypeScript)
│   ├── src/
│   │   ├── config/     # Configuration management
│   │   ├── middleware/ # Express middleware (auth)
│   │   ├── routes/     # API routes (chat, search, auth)
│   │   └── services/   # Business logic (Langfuse, history)
│   └── package.json
├── fe/                 # Frontend (React + Vite + TypeScript)
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   └── pages/      # Page components
│   └── package.json
└── package.json        # Root workspace configuration
```

## Features

- **AI Chat Proxy**: Proxy RAGFlow chat interface with logging
- **AI Search Proxy**: Proxy RAGFlow search interface with logging
- **Langfuse Integration**: Log all user prompts and AI responses
- **Chat History**: View previous conversations
- **SSO Authentication**: Microsoft Entra ID integration (planned)

## Development

### Backend (Port 3001)
```bash
npm run dev:be
```

### Frontend (Port 5173)
```bash
npm run dev:fe
```

## Environment Variables

See `.env.example` files in `be/` and `fe/` directories.

## License

MIT
