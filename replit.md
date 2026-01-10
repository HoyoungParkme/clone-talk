# LastTalk - KakaoTalk Chat Persona Generator

## Overview

LastTalk is a web application that analyzes KakaoTalk chat exports to generate AI personas that mimic a person's conversation style. Users upload Korean chat logs, the system parses and analyzes the messages to build a personality profile, and then provides an interactive chat interface where users can converse with the generated persona.

The application uses a hybrid architecture with a React frontend, Express.js middleware server, and a Python FastAPI backend for AI processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with custom Replit plugins for development

The frontend follows a page-based structure with four main views:
1. Home - File upload interface
2. Processing - Job progress monitoring
3. Review - Persona profile editing
4. Chat - Conversational interface with the AI persona

### Backend Architecture
- **Primary API**: Python FastAPI running on port 8000
- **Middleware**: Express.js server that proxies `/api` requests to the Python backend
- **Process Management**: Node.js spawns the Python backend as a child process

The Express server serves dual purposes:
1. Proxies API requests to the FastAPI backend
2. Serves the Vite development server or static production assets

### Data Flow
1. User uploads KakaoTalk `.txt` export file
2. Backend parses the chat format (supports multiple Korean chat export formats)
3. Messages are embedded using Jina AI embeddings
4. Embeddings stored in ChromaDB for RAG retrieval
5. OpenAI generates persona profile and powers chat responses
6. Chat uses streaming responses for real-time interaction

### Data Storage
- **Vector Database**: ChromaDB (persistent, stored in `./data/chroma`)
- **Job Storage**: In-memory dictionary (MVP approach)
- **User Storage**: In-memory Map with interface for future database migration
- **Session Management**: UUID-based session IDs for chat continuity

### API Design
- RESTful endpoints defined in `shared/routes.ts`
- Zod schemas for request/response validation in `shared/schema.ts`
- Streaming chat responses via POST (not SSE EventSource)

Key endpoints:
- `POST /api/upload` - Upload chat file, returns job_id
- `GET /api/jobs/:job_id` - Poll job status and progress
- `POST /api/persona/confirm` - Save edited persona profile
- `POST /api/chat/stream` - Stream chat responses
- `GET /api/agent/poll` - Check for proactive agent messages

## External Dependencies

### AI Services
- **OpenAI API**: Powers persona generation and chat responses (key stored in `ANTHROPIC_API_KEY` environment variable - naming quirk noted in code)
- **Jina AI Embeddings API**: Creates vector embeddings for RAG retrieval (`JINA_API_KEY`)

### Database
- **PostgreSQL**: Configured via Drizzle ORM for future user data (requires `DATABASE_URL`)
- **ChromaDB**: Local persistent vector store for chat memory retrieval

### Frontend Libraries
- Full shadcn/ui component suite (Radix primitives)
- TanStack React Query for data fetching
- Framer Motion for animations
- Wouter for routing

### Backend Libraries
- FastAPI + Uvicorn for Python API
- ChromaDB for vector storage
- Pydantic for data validation
- python-multipart for file uploads