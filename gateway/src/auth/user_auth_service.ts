import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'jarvis-enterprise-secure-jwt-secret-2026';
const JWT_EXPIRES_IN = '7d';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export class UserAuthService {
  /**
   * Register a new user with secure password hash
   */
  public static async signup(name: string, email: string, password: string): Promise<{ user: UserRecord; token: string; conversationId: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanName || !password) {
      throw new Error('Name, email, and password are required.');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM public.users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      const err: any = new Error('An account with this email already exists.');
      err.code = 'EMAIL_EXISTS';
      err.statusCode = 409;
      throw err;
    }

    // Hash password
    const passwordHash = bcrypt.hashSync(password, 10);

    // Insert user
    const insertRes = await pool.query(
      'INSERT INTO public.users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at as "createdAt"',
      [cleanName, cleanEmail, passwordHash]
    );
    const user: UserRecord = insertRes.rows[0];

    // Create initial welcome conversation
    const convRes = await pool.query(
      'INSERT INTO public.conversations (user_id, title) VALUES ($1, $2) RETURNING id',
      [user.id, 'New Chat']
    );
    const conversationId = convRes.rows[0].id;

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { user, token, conversationId };
  }

  /**
   * Authenticate existing user with email and password
   */
  public static async login(email: string, password: string): Promise<{ user: UserRecord; token: string }> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !password) {
      throw new Error('Email and password are required.');
    }

    const res = await pool.query(
      'SELECT id, name, email, password_hash as "passwordHash" FROM public.users WHERE LOWER(email) = $1',
      [cleanEmail]
    );

    if (res.rows.length === 0) {
      const err: any = new Error('Invalid email or password.');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    const row = res.rows[0];
    const passwordMatch = bcrypt.compareSync(password, row.passwordHash);
    if (!passwordMatch) {
      const err: any = new Error('Invalid email or password.');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    const user: UserRecord = {
      id: row.id,
      name: row.name,
      email: row.email,
    };

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { user, token };
  }

  /**
   * Verify and decode JWT token
   */
  public static verifyToken(token: string): { userId: string; email: string; name: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; name: string };
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Fetch user by UUID
   */
  public static async getUserById(userId: string): Promise<UserRecord | null> {
    try {
      const res = await pool.query(
        'SELECT id, name, email, created_at as "createdAt" FROM public.users WHERE id = $1',
        [userId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0];
    } catch {
      return null;
    }
  }
}
