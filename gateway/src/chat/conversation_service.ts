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
   * List conversations for a specific authenticated user (Strict User-Level Isolation)
   */
  public static async listConversations(userId: string): Promise<ConversationRecord[]> {
    const res = await pool.query(
      `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
       FROM public.conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return res.rows;
  }

  /**
   * Create a new conversation for a user
   */
  public static async createConversation(userId: string, title: string = 'New Chat'): Promise<ConversationRecord> {
    const res = await pool.query(
      `INSERT INTO public.conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"`,
      [userId, title]
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
    const convRes = await pool.query(
      `SELECT id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"
       FROM public.conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convRes.rows.length === 0) {
      return null;
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
    const res = await pool.query(
      `UPDATE public.conversations
       SET title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id as "userId", title, created_at as "createdAt", updated_at as "updatedAt"`,
      [newTitle.trim(), conversationId, userId]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  /**
   * Delete conversation and cascading messages
   */
  public static async deleteConversation(userId: string, conversationId: string): Promise<boolean> {
    const res = await pool.query(
      `DELETE FROM public.conversations
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
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

