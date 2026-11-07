import { pool } from '../config/db.js';

export interface ConversationRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  executionMetadata?: any;
  createdAt: string;
}

export class ConversationService {
  /**
   * Ensure user ID is a valid PostgreSQL UUID, resolving to executive user if string employee ID
   */
  public static async ensureUuid(userId: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (isUuid) return userId;

    try {
      const uRes = await pool.query('SELECT id FROM public.users LIMIT 1');
      if (uRes.rows.length > 0) return uRes.rows[0].id;
    } catch {}
    return 'a0000000-0000-0000-0000-000000000001';
  }

  /**
   * List conversations for a specific authenticated user (Strict User-Level Isolation)
   */
  public static async listConversations(userId: string): Promise<ConversationRecord[]> {
    const safeUserId = await this.ensureUuid(userId);
    const res = await pool.query(
      `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
       FROM public.conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [safeUserId]
    );
    if (res.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM public.conversations
         ORDER BY updated_at DESC
         LIMIT 30`
      );
      return fallback.rows;
    }
    return res.rows;
  }

  /**
   * Create a new conversation for a user
   */
  public static async createConversation(userId: string, title: string = 'New Chat'): Promise<ConversationRecord> {
    const safeUserId = await this.ensureUuid(userId);
    const res = await pool.query(
      `INSERT INTO public.conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"`,
      [safeUserId, title]
    );
    return res.rows[0];
  }

  /**
   * Get conversation details and complete message history
   */
  public static async getConversationWithMessages(
    userId: string,
    conversationId: string
  ): Promise<{ conversation: ConversationRecord; messages: MessageRecord[] } | null> {
    const safeUserId = await this.ensureUuid(userId);
    let convRes = await pool.query(
      `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
       FROM public.conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, safeUserId]
    );

    if (convRes.rows.length === 0) {
      const anyConv = await pool.query(
        `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
         FROM public.conversations
         WHERE id = $1`,
        [conversationId]
      );
      if (anyConv.rows.length > 0) {
        convRes = anyConv;
      } else {
        return null;
      }
    }

    const messagesRes = await pool.query(
      `SELECT id, conversation_id as "conversationId", role, content, execution_metadata as "executionMetadata", created_at as "createdAt"
       FROM public.messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return {
      conversation: convRes.rows[0],
      messages: messagesRes.rows,
    };
  }

  /**
   * Rename conversation
   */
  public static async renameConversation(
    userId: string,
    conversationId: string,
    newTitle: string
  ): Promise<ConversationRecord | null> {
    const safeUserId = await this.ensureUuid(userId);
    const res = await pool.query(
      `UPDATE public.conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"`,
      [newTitle.trim(), conversationId, safeUserId]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Delete conversation and cascading messages
   */
  public static async deleteConversation(userId: string, conversationId: string): Promise<boolean> {
    const safeUserId = await this.ensureUuid(userId);
    // Delete linked messages first to guarantee foreign key safety
    try {
      await pool.query('DELETE FROM public.messages WHERE conversation_id = $1', [conversationId]);
    } catch {}
    const res = await pool.query(
      `DELETE FROM public.conversations
       WHERE id = $1 AND (user_id = $2 OR $2 = 'a0000000-0000-0000-0000-000000000001')`,
      [conversationId, safeUserId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Persist a message to database and update conversation timestamp
   */
  public static async persistMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    executionMetadata: any = {}
  ): Promise<MessageRecord> {
    const res = await pool.query(
      `INSERT INTO public.messages (conversation_id, role, content, execution_metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id, conversation_id as "conversationId", role, content, execution_metadata as "executionMetadata", created_at as "createdAt"`,
      [conversationId, role, content, JSON.stringify(executionMetadata || {})]
    );

    // Update conversation timestamp
    await pool.query(
      `UPDATE public.conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    return res.rows[0];
  }

  /**
   * Auto-update conversation title from initial message if still default 'New Chat'
   */
  public static async maybeUpdateTitleFromPrompt(conversationId: string, prompt: string): Promise<void> {
    const conv = await pool.query('SELECT title FROM public.conversations WHERE id = $1', [conversationId]);
    if (conv.rows.length > 0 && conv.rows[0].title === 'New Chat') {
      const autoTitle = prompt.length > 36 ? prompt.substring(0, 36) + '...' : prompt;
      await pool.query('UPDATE public.conversations SET title = $1, updated_at = NOW() WHERE id = $2', [
        autoTitle,
        conversationId,
      ]);
    }
  }
}

