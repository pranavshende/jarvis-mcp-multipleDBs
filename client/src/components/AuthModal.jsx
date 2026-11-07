import React, { useState } from 'react';
import { signupUser, loginUser } from '../api/client';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await loginUser(email, password);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
          onClose();
        } else {
          setError(res.message || 'Login failed. Please check your credentials.');
        }
      } else {
        if (!name.trim()) {
          setError('Full name is required.');
          setLoading(false);
          return;
        }
        const res = await signupUser(name, email, password);
        if (res.success && res.user) {
          onAuthSuccess(res.user, res.conversationId);
          onClose();
        } else {
          setError(res.message || 'Signup failed. Please try again.');
        }
      }
    } catch (err) {
      setError(err.message || 'Network error occurred. Ensure the server is online.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setName('Pranav Shende');
    setEmail('pranav@meridian.com');
    setPassword('Jarvis2026!');
    setError('');
    setLoading(true);

    try {
      const res = await loginUser('pranav@meridian.com', 'Jarvis2026!');
      if (res.success && res.user) {
        onAuthSuccess(res.user);
        onClose();
      } else {
        // If demo user password was different, auto-signup
        const signupRes = await signupUser('Pranav Shende', 'pranav.founder@meridian.com', 'Jarvis2026!');
        if (signupRes.success && signupRes.user) {
          onAuthSuccess(signupRes.user, signupRes.conversationId);
          onClose();
        }
      }
    } catch {
      // Fallback signup
      try {
        const signupRes = await signupUser('Pranav Shende', 'pranav.founder@meridian.com', 'Jarvis2026!');
        if (signupRes.success && signupRes.user) {
          onAuthSuccess(signupRes.user, signupRes.conversationId);
          onClose();
        }
      } catch (e) {
        setError(e.message || 'Quick sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
          border: '1px solid #e5e5e0',
          padding: '28px',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#0e372d',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 10px auto',
              boxShadow: '0 4px 12px rgba(14, 55, 45, 0.2)'
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>
            Jarvis Enterprise AI
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            Meridian Supply Chain Intelligence Platform
          </p>
        </div>

        {/* Auth Tabs */}
        <div
          style={{
            display: 'flex',
            background: '#f3f2ee',
            borderRadius: '10px',
            padding: '3px',
            marginBottom: '18px'
          }}
        >
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '8px',
              border: 'none',
              background: isLogin ? '#ffffff' : 'transparent',
              color: isLogin ? '#111827' : '#6b7280',
              fontWeight: isLogin ? '600' : '500',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: isLogin ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: '8px',
              border: 'none',
              background: !isLogin ? '#ffffff' : 'transparent',
              color: !isLogin ? '#111827' : '#6b7280',
              fontWeight: !isLogin ? '600' : '500',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: !isLogin ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '14px',
              lineHeight: '1.4'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '13.5px',
                  color: '#111827',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: '#fafaf9'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
              Work Email
            </label>
            <input
              type="email"
              placeholder="name@meridian.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13.5px',
                color: '#111827',
                boxSizing: 'border-box',
                outline: 'none',
                background: '#fafaf9'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '13.5px',
                color: '#111827',
                boxSizing: 'border-box',
                outline: 'none',
                background: '#fafaf9'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '9px',
              border: 'none',
              background: '#0e372d',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              boxShadow: '0 2px 6px rgba(14, 55, 45, 0.25)',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Authenticating...' : (isLogin ? 'Sign In to Jarvis' : 'Create Account')}
          </button>
        </form>

        {/* Demo Quick Button */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px dashed #0e372d',
              color: '#0e372d',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              width: '100%',
              transition: 'background 0.2s'
            }}
          >
            ⚡ Quick Sign-In as Executive (Pranav Shende)
          </button>
        </div>
      </div>
    </div>
  );
}
