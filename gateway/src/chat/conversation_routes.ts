import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ConversationService } from './conversation_service.js';
import { authenticateRequest } from '../auth/authentication.js';

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  // All conversation routes require authentication
  fastify.addHook('preHandler', authenticateRequest);

  // 1. List conversations for current user
  fastify.get('/api/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.userContext!;
      const conversations = await ConversationService.listConversations(user.userId);
      return reply.send({ success: true, conversations });
    } catch (err: any) {
      return reply.status(500).send({ error: 'DB_ERROR', message: err.message });
    }
  });

  // 2. Create new conversation
  fastify.post('/api/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.userContext!;
      const { title } = (request.body as any) || {};
      const conversation = await ConversationService.createConversation(user.userId, title || 'New Chat');
      return reply.status(201).send({ success: true, conversation });
    } catch (err: any) {
      return reply.status(500).send({ error: 'DB_ERROR', message: err.message });
    }
  });

  // 3. Get conversation with full message history
  fastify.get('/api/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.userContext!;
      const { id } = request.params as { id: string };
      const data = await ConversationService.getConversationWithMessages(user.userId, id);
      if (!data) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Conversation not found or access denied.' });
      }
      return reply.send({ success: true, ...data });
    } catch (err: any) {
      return reply.status(500).send({ error: 'DB_ERROR', message: err.message });
    }
  });

  // 4. Rename conversation
  fastify.patch('/api/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.userContext!;
      const { id } = request.params as { id: string };
      const { title } = (request.body as any) || {};
      if (!title || !title.trim()) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Title is required.' });
      }

      const updated = await ConversationService.renameConversation(user.userId, id, title);
      if (!updated) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Conversation not found or access denied.' });
      }
      return reply.send({ success: true, conversation: updated });
    } catch (err: any) {
      return reply.status(500).send({ error: 'DB_ERROR', message: err.message });
    }
  });

  // 5. Delete conversation
  fastify.delete('/api/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.userContext!;
      const { id } = request.params as { id: string };
      const deleted = await ConversationService.deleteConversation(user.userId, id);
      if (!deleted) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Conversation not found or access denied.' });
      }
      return reply.send({ success: true, message: 'Conversation deleted.' });
    } catch (err: any) {
      return reply.status(500).send({ error: 'DB_ERROR', message: err.message });
    }
  });
}

