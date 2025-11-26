import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage for development
// TODO: Replace with database (PostgreSQL, MongoDB, etc.) for production
const chatSessions = new Map<string, ChatSession>();

/**
 * Create a new chat session
 */
export function createSession(userId: string, title?: string): ChatSession {
  const session: ChatSession = {
    id: uuidv4(),
    userId,
    title: title ?? 'New Chat',
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  chatSessions.set(session.id, session);
  return session;
}

/**
 * Get a chat session by ID
 */
export function getSession(sessionId: string): ChatSession | undefined {
  return chatSessions.get(sessionId);
}

/**
 * Get all chat sessions for a user
 */
export function getUserSessions(userId: string): ChatSession[] {
  return Array.from(chatSessions.values())
    .filter(session => session.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Add a message to a chat session
 */
export function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): ChatMessage | null {
  const session = chatSessions.get(sessionId);
  if (!session) {
    return null;
  }

  const message: ChatMessage = {
    id: uuidv4(),
    role,
    content,
    timestamp: new Date(),
  };

  session.messages.push(message);
  session.updatedAt = new Date();

  // Update title from first user message if still default
  if (session.title === 'New Chat' && role === 'user') {
    session.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
  }

  return message;
}

/**
 * Delete a chat session
 */
export function deleteSession(sessionId: string): boolean {
  return chatSessions.delete(sessionId);
}

/**
 * Clear all sessions for a user
 */
export function clearUserSessions(userId: string): number {
  let count = 0;
  for (const [id, session] of chatSessions) {
    if (session.userId === userId) {
      chatSessions.delete(id);
      count++;
    }
  }
  return count;
}
