import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TokenService } from '../../auth/token_service.js';
import { RBACService } from '../../auth/rbac.js';
import { ModelRouter } from '../../orchestrator/model_router.js';
import { AuditService } from '../../audit/audit_service.js';
import { FlaskClient } from '../../integrations/flask_client.js';
import { SlackService } from '../../integrations/slack_client.js';
import { pool } from '../../config/db.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // Enforce Admin RBAC check on all admin routes
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // If request has no userContext (or unauthenticated), return 401
    const user = request.userContext;
    if (!user) {
      reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Admin authentication required.' });
      return;
    }

    if (!RBACService.canAccessAdmin(user)) {
      reply.status(403).send({
        error: 'FORBIDDEN',
        message: `Role '${user.role}' is not authorized to access the Jarvis Admin Control Plane.`,
      });
      return;
    }
  });

  // --- 1. User & Token Management ---
  fastify.get('/api/admin/tokens', async (_req, reply) => {
    const tokens = await TokenService.listTokens(100, 0);
    reply.send({ tokens });
  });

  fastify.post('/api/admin/tokens', async (req, reply) => {
    const body = (req.body as any) || {};
    if (!body.userId || !body.corporateEmail || !body.tokenName || !body.role) {
      reply.status(400).send({
        error: 'BAD_REQUEST',
        message: 'Missing required fields: userId, corporateEmail, tokenName, role.',
      });
      return;
    }

    const { tokenRecord, rawToken } = await TokenService.createToken({
      userId: body.userId,
      corporateEmail: body.corporateEmail,
      tokenName: body.tokenName,
      role: body.role,
      department: body.department,
      allowedScopes: body.allowedScopes,
      expiresInDays: body.expiresInDays,
    });

    reply.status(201).send({
      message: 'Token created successfully. Store this token securely; it will not be shown again.',
      tokenRecord,
      rawToken,
    });
  });

  fastify.post('/api/admin/tokens/:id/revoke', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const success = await TokenService.revokeToken(req.params.id);
    if (!success) {
      reply.status(404).send({ error: 'NOT_FOUND', message: 'Token not found.' });
      return;
    }
    reply.send({ status: 'SUCCESS', message: 'Token revoked successfully.' });
  });

  fastify.post('/api/admin/tokens/:id/rotate', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const rotated = await TokenService.rotateToken(req.params.id);
    if (!rotated) {
      reply.status(404).send({ error: 'NOT_FOUND', message: 'Token not found.' });
      return;
    }
    reply.send({
      status: 'SUCCESS',
      message: 'Token rotated. Store new token securely.',
      newRecord: rotated.newRecord,
      rawToken: rotated.rawToken,
    });
  });

  // --- 2. Model Registry & Spend Ledger ---
  fastify.get('/api/admin/models', async (_req, reply) => {
    const tiers = ModelRouter.getTiersSummary();
    reply.send({ tiers });
  });

  fastify.get('/api/admin/models/spend', async (req: FastifyRequest<{ Querystring: { days?: string } }>, reply) => {
    const days = parseInt(req.query.days || '30', 10);
    const summary = await AuditService.getUsageLedgerSummary(days);
    reply.send({ days, summary });
  });

  // --- 3. Phase 3 Memory Governance Integration ---
  fastify.get('/api/admin/memory/candidates', async (_req, reply) => {
    const res = await FlaskClient.getCandidateFacts();
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });

  fastify.post('/api/admin/memory/candidates/:id/approve', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const user = req.userContext!;
    const comments = (req.body as any)?.comments || 'Approved by Admin';
    const res = await FlaskClient.approveCandidateFact(req.params.id, comments, user.email, user.role);
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });

  fastify.post('/api/admin/memory/candidates/:id/reject', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const user = req.userContext!;
    const comments = (req.body as any)?.comments || 'Rejected by Admin';
    const res = await FlaskClient.rejectCandidateFact(req.params.id, comments, user.email, user.role);
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });

  // --- 4. Phase 2 Alerts & Actions Integration ---
  fastify.get('/api/admin/alerts', async (_req, reply) => {
    const res = await FlaskClient.getAlerts('ACTIVE');
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });

  fastify.get('/api/admin/actions/pending', async (_req, reply) => {
    const res = await FlaskClient.getPendingActions();
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });

  fastify.get('/api/admin/actions/history', async (_req, reply) => {
    const res = await FlaskClient.getActionHistory(50);
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });

  // --- 5. System Health & Gateway Monitoring ---
  fastify.get('/api/admin/health', async (_req, reply) => {
    let dbStatus = 'UNHEALTHY';
    try {
      const dbCheck = await pool.query('SELECT 1 as live');
      if (dbCheck.rows.length > 0) dbStatus = 'HEALTHY';
    } catch {}

    const flaskHealth = await FlaskClient.checkHealth();
    const slackStatus = SlackService.getStatus();

    reply.send({
      gateway: 'HEALTHY',
      database: dbStatus,
      flaskBackend: flaskHealth.success ? 'HEALTHY' : 'DOWN',
      slackSocket: slackStatus.connected ? 'CONNECTED' : (slackStatus.configured ? 'STANDBY' : 'UNCONFIGURED'),
      timestamp: new Date().toISOString(),
    });
  });

  fastify.get('/api/admin/sync-status', async (_req, reply) => {
    const res = await FlaskClient.getSyncStatus();
    reply.status(res.statusCode).send(res.data || { error: res.error });
  });
}
