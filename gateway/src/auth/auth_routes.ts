import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserAuthService } from './user_auth_service.js';
import { authenticateRequest } from './authentication.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // 1. Signup
  fastify.post('/api/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, email, password } = (request.body as any) || {};
      if (!name || !email || !password) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'Name, email, and password are required.',
        });
      }

      const { user, token, conversationId } = await UserAuthService.signup(name, email, password);

      // Set HTTP-only, SameSite cookie
      reply.setCookie('jarvis_session', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.status(201).send({
        success: true,
        user,
        token,
        conversationId,
        message: 'Account created successfully.',
      });
    } catch (err: any) {
      const status = err.statusCode || 400;
      return reply.status(status).send({
        error: err.code || 'SIGNUP_FAILED',
        message: err.message || 'Failed to create account.',
      });
    }
  });

  // 2. Login
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, password } = (request.body as any) || {};
      if (!email || !password) {
        return reply.status(400).send({
          error: 'BAD_REQUEST',
          message: 'Email and password are required.',
        });
      }

      const { user, token } = await UserAuthService.login(email, password);

      // Set HTTP-only, SameSite cookie
      reply.setCookie('jarvis_session', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({
        success: true,
        user,
        token,
        message: 'Logged in successfully.',
      });
    } catch (err: any) {
      const status = err.statusCode || 401;
      return reply.status(status).send({
        error: err.code || 'LOGIN_FAILED',
        message: err.message || 'Authentication failed.',
      });
    }
  });

  // 3. Logout
  fastify.post('/api/auth/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('jarvis_session', { path: '/' });
    return reply.send({
      success: true,
      message: 'Logged out successfully.',
    });
  });

  // 4. Current Authenticated User (Session Verification)
  fastify.get('/api/auth/me', { preHandler: authenticateRequest }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userContext = request.userContext!;
    const user = await UserAuthService.getUserById(userContext.userId);

    if (!user) {
      // If userContext came from standard admin bearer token, synthesize user object
      return reply.send({
        success: true,
        user: {
          id: userContext.userId,
          name: 'Pranav Shende',
          email: userContext.email,
          role: userContext.role,
        },
      });
    }

    return reply.send({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userContext.role,
      },
    });
  });
}
