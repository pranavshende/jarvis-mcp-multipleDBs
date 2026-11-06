export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  intent?: string;
  entitiesExtracted?: Record<string, any>;
  routeTaken?: string;
  citations?: string[];
}

export interface EntityMemoryState {
  partnerName?: string;
  partnerId?: string;
  warehouseCode?: string;
  policyName?: string;
  incidentRef?: string;
  metricType?: string;
  targetDate?: string;
  actionId?: string;
}

export interface SessionMemory {
  userId: string;
  sessionId: string;
  turns: ConversationTurn[];
  entityState: EntityMemoryState;
  summary?: string;
  createdAt: number;
  lastActiveAt: number;
}

export class ConversationMemoryManager {
  // In-memory session store (User+Session isolated)
  private static sessions: Map<string, SessionMemory> = new Map();
  private static MAX_TURNS_BEFORE_SUMMARIZATION = 10;
  private static SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  private static buildKey(userId: string, sessionId: string): string {
    const cleanUser = (userId || 'anonymous').trim().toLowerCase();
    const cleanSession = (sessionId || 'default').trim().toLowerCase();
    return `${cleanUser}::${cleanSession}`;
  }

  public static getSession(userId: string, sessionId: string): SessionMemory {
    const key = this.buildKey(userId, sessionId);
    const existing = this.sessions.get(key);
    const now = Date.now();

    if (existing) {
      if (now - existing.lastActiveAt > this.SESSION_TTL_MS) {
        this.sessions.delete(key);
      } else {
        existing.lastActiveAt = now;
        return existing;
      }
    }

    const newSession: SessionMemory = {
      userId,
      sessionId,
      turns: [],
      entityState: {},
      createdAt: now,
      lastActiveAt: now,
    };
    this.sessions.set(key, newSession);
    return newSession;
  }

  public static getRecentHistory(userId: string, sessionId: string, limit = 6): ConversationTurn[] {
    const session = this.getSession(userId, sessionId);
    return session.turns.slice(-limit);
  }

  public static getEntityState(userId: string, sessionId: string): EntityMemoryState {
    const session = this.getSession(userId, sessionId);
    return { ...session.entityState };
  }

  public static addTurn(
    userId: string,
    sessionId: string,
    turn: ConversationTurn,
    extractedEntities?: Partial<EntityMemoryState>
  ): void {
    const session = this.getSession(userId, sessionId);
    session.turns.push(turn);
    session.lastActiveAt = Date.now();

    if (extractedEntities) {
      // Merge new entity state, preserving previous ones if not overwritten
      session.entityState = {
        ...session.entityState,
        ...Object.fromEntries(
          Object.entries(extractedEntities).filter(([_, v]) => v != null && v !== '')
        ),
      };
    }

    // Summarize older turns if window expands
    if (session.turns.length > this.MAX_TURNS_BEFORE_SUMMARIZATION) {
      this.summarizeOldTurns(session);
    }
  }

  private static summarizeOldTurns(session: SessionMemory): void {
    // Retain the last 6 turns verbatim, compress preceding turns into summary notes
    const turnsToCompress = session.turns.slice(0, session.turns.length - 6);
    const entitiesMentioned = Object.entries(session.entityState)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    session.summary = `Prior context involved: ${entitiesMentioned}. Discussed: ${turnsToCompress
      .slice(-2)
      .map((t) => t.content.slice(0, 50))
      .join(' -> ')}.`;

    session.turns = session.turns.slice(-6);
  }

  public static clearSession(userId: string, sessionId: string): void {
    const key = this.buildKey(userId, sessionId);
    this.sessions.delete(key);
  }
}

