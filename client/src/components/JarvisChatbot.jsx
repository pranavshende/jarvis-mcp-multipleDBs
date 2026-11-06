import React, { useState, useEffect, useRef } from 'react';
import { queryGatewayIntent, searchKnowledge } from '../api/client';

export default function JarvisChatbot({ onNavigateTab }) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);

  // Chat sessions history
  const [chatSessions, setChatSessions] = useState([
    { id: 'sess-1', title: 'Review and Improve Roadmap', messages: [] },
    { id: 'sess-2', title: 'System Design Assessment', messages: [] },
    { id: 'sess-3', title: 'Control Antigravity Remotely', messages: [] }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState('new');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleNewChat = () => {
    setCurrentSessionId('new');
    setMessages([]);
    setInputQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSelectSession = (session) => {
    setCurrentSessionId(session.id);
    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      // Seed dummy conversation for existing mock sessions
      setMessages([
        { id: 'seed-1', role: 'user', content: session.title },
        { 
          id: 'seed-2', 
          role: 'assistant', 
          content: `Here is the operational breakdown for **${session.title}**. All data is validated against Meridian Supply Chain knowledge records and deterministic warehouse schemas.`,
          route: 'KNOWLEDGE',
          citations: ['Source: partner-terms.md (v1.0) -> Operations'],
          latencyMs: 142.5,
          fromCache: true
        }
      ]);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const query = inputQuery.trim();
    if (!query || isLoading) return;

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);

    const startTime = performance.now();

    try {
      // Call live Fastify Gateway Intent / RAG API with session ID
      const res = await queryGatewayIntent(query, currentSessionId);
      const latency = Math.round((performance.now() - startTime) * 100) / 100;

      const botMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.response || (typeof res === 'string' ? res : 'No response content returned.'),
        route: res.route || 'KNOWLEDGE',
        citations: res.citations || [],
        toolsInvoked: res.toolsInvoked || [],
        latencyMs: res.latencyMs || latency,
        fromCache: res.fromCache || false,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, botMessage]);

      // Update current or new chat session
      if (currentSessionId === 'new') {
        const newId = `sess-${Date.now()}`;
        const newTitle = query.length > 28 ? query.substring(0, 28) + '...' : query;
        const newSession = {
          id: newId,
          title: newTitle,
          messages: [userMessage, botMessage]
        };
        setChatSessions((prev) => [newSession, ...prev]);
        setCurrentSessionId(newId);
      }
    } catch (err) {
      const errorMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        isError: true,
        content: `Error contacting Jarvis intelligence layer: ${err.message}. Ensure Gateway (port 4000) and Flask (port 5000) are healthy.`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'What are the Gold partner credit terms and payment policies?',
    'Why is Partner 301 on credit hold and what is their exposure?',
    'How many packages were received yesterday at EWR1 vs ONT1?',
    'What are the SOP inspection rules for return grading?'
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 65px)', background: '#000000', color: '#ececec', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: 'hidden' }}>
      
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (ChatGPT Style)                                           */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: sidebarOpen ? '260px' : '0px',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          background: '#171717',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative'
        }}
      >
        <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px', color: '#ffffff' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#3b82f6', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>J</span>
            Jarvis AI
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Search Icon */}
            <button
              onClick={() => {}}
              title="Search"
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            {/* Collapse Sidebar Icon */}
            <button
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div style={{ padding: '8px 12px 12px' }}>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              background: '#212121',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '500',
              textAlign: 'left'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            New chat
          </button>
        </div>

        {/* Quick Menu Links */}
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={() => onNavigateTab && onNavigateTab('sync')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#c4c7c5', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Scheduled Sync
          </button>
          <button
            onClick={() => onNavigateTab && onNavigateTab('knowledge')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#c4c7c5', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Library (SOPs & Docs)
          </button>
          <button
            onClick={() => onNavigateTab && onNavigateTab('admin')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#c4c7c5', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>
            Plugins & Tools (MCP)
          </button>
          <button
            onClick={() => onNavigateTab && onNavigateTab('metrics')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#c4c7c5', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Explore Deterministic Metrics
          </button>
        </div>

        {/* Scrollable Project Folders & Recent Chats */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* Projects / Domains */}
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#71717a', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Projects
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
            {[
              'city wide cctv surveillance',
              'jan_Sampark',
              'lumpy skin disease',
              'Solar Industries Internship Project',
              'Warehouse Operations (EWR1/ONT1)'
            ].map((p, idx) => (
              <div
                key={idx}
                onClick={() => setInputQuery(`Provide a briefing on ${p}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 10px', borderRadius: '8px', color: '#d1d5db', fontSize: '12.5px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#212121'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</span>
              </div>
            ))}
          </div>

          {/* Recents */}
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#71717a', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {chatSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  color: currentSessionId === s.id ? '#ffffff' : '#d1d5db',
                  background: currentSessionId === s.id ? '#212121' : 'transparent',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
                onMouseEnter={(e) => { if (currentSessionId !== s.id) e.currentTarget.style.background = '#1b1b1b'; }}
                onMouseLeave={(e) => { if (currentSessionId !== s.id) e.currentTarget.style.background = currentSessionId === s.id ? '#212121' : 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User Profile Footer (Exactly as in screenshot) */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#171717' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '13px' }}>
              PS
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Pranav Shende</div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>Go • Executive Access</div>
            </div>
          </div>
          <div style={{ color: '#71717a', fontSize: '12px' }}>
            •••
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CHAT CANVAS                                                       */}
      {/* ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#000000', overflow: 'hidden' }}>
        
        {/* Top Floating Bar */}
        <header style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#9ca3af', fontSize: '14px', fontWeight: '500' }}>
              <span>Jarvis 1.0 Enterprise</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              ⚡ 746 Chunks Indexed
            </span>
            <button
              onClick={() => onNavigateTab && onNavigateTab('founder')}
              style={{ background: '#212121', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
            >
              Operations Dashboard ↗
            </button>
          </div>
        </header>

        {/* Conversation Stream or Hero Center */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 16px 140px' }}>
          {messages.length === 0 ? (
            /* ================================================================= */
            /* ZERO STATE: EXACT HERO SCREENSHOT LAYOUT                          */
            /* ================================================================= */
            <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '800px', transform: 'translateY(-20px)' }}>
              <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#ffffff', marginBottom: '28px', letterSpacing: '-0.02em', textAlign: 'center' }}>
                Where should we begin?
              </h1>

              {/* Centered Floating Search Bar (Exactly matching screenshot) */}
              <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>
                <form
                  onSubmit={handleSubmit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#212121',
                    borderRadius: '32px',
                    padding: '8px 12px 8px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  {/* Left Plus Button */}
                  <button
                    type="button"
                    onClick={() => {}}
                    title="Add context / tools"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#2f2f2f',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>

                  {/* Input field */}
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask Jarvis..."
                    autoFocus
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#ffffff',
                      fontSize: '15px',
                      padding: '0 14px',
                      fontFamily: 'inherit'
                    }}
                  />

                  {/* Right side controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Think Mode Pill */}
                    <button
                      type="button"
                      onClick={() => setIsDeepThink(!isDeepThink)}
                      title="Deep Reasoning vs Fast Tier"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: isDeepThink ? 'rgba(99, 102, 241, 0.25)' : '#2f2f2f',
                        border: isDeepThink ? '1px solid #6366f1' : '1px solid transparent',
                        color: isDeepThink ? '#a5b4fc' : '#d1d5db',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      Think
                    </button>

                    {/* Microphone Icon */}
                    <button
                      type="button"
                      onClick={() => {}}
                      title="Voice Input"
                      style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </button>

                    {/* Circular Blue Submit/Voice Button */}
                    <button
                      type="submit"
                      disabled={!inputQuery.trim() || isLoading}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: inputQuery.trim() ? '#2563eb' : '#2563eb',
                        border: 'none',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: inputQuery.trim() ? 'pointer' : 'default',
                        opacity: inputQuery.trim() ? 1 : 0.8,
                        transition: 'opacity 0.15s ease'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
                    </button>
                  </div>
                </form>

                {/* Prompt Suggestion Chips */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
                  {samplePrompts.map((p, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setInputQuery(p); }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: '#141414',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#c4c7c5',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        lineHeight: '1.4'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = '#1e1e1e'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = '#141414'; }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ================================================================= */
            /* ACTIVE CONVERSATION STREAM                                        */
            /* ================================================================= */
            <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '20px' }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                    width: '100%'
                  }}
                >
                  {/* User Bubble */}
                  {m.role === 'user' ? (
                    <div
                      style={{
                        maxWidth: '80%',
                        background: '#2f2f2f',
                        color: '#ffffff',
                        padding: '12px 18px',
                        borderRadius: '22px',
                        fontSize: '15px',
                        lineHeight: '1.5'
                      }}
                    >
                      {m.content}
                    </div>
                  ) : (
                    /* Assistant Output */
                    <div style={{ display: 'flex', gap: '14px', width: '100%', maxWidth: '100%' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#3b82f6',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          flexShrink: 0
                        }}
                      >
                        J
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        {/* Status Pills */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                            {m.route || 'KNOWLEDGE'}
                          </span>
                          {m.fromCache && (
                            <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(74, 222, 128, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                              ⚡ CACHED ({m.latencyMs?.toFixed(1) || '0.1'}ms)
                            </span>
                          )}
                          {!m.fromCache && m.latencyMs && (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              ⏱️ {m.latencyMs.toFixed(1)}ms
                            </span>
                          )}
                        </div>

                        {/* Content text */}
                        <div
                          style={{
                            fontSize: '15px',
                            lineHeight: '1.65',
                            color: m.isError ? '#f87171' : '#e5e7eb',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {m.content}
                        </div>

                        {/* RAG Citations Cards */}
                        {m.citations && m.citations.length > 0 && (
                          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                              Certified Knowledge Citations ({m.citations.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {m.citations.map((c, cIdx) => (
                                <button
                                  key={cIdx}
                                  onClick={() => setActiveCitation(c)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    background: '#1e1e1e',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: '#60a5fa',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  <span>{c}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    J
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '14px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1.2s infinite' }}></span>
                    Searching pgvector RAG memory & computing metrics...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. FLOATING BOTTOM INPUT BAR (When Conversation is Active)                */}
        {/* ========================================================================= */}
        {messages.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 20px 24px',
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 40%, #000000 100%)',
              display: 'flex',
              justifyContent: 'center',
              zIndex: 20
            }}
          >
            <div style={{ width: '100%', maxWidth: '760px' }}>
              <form
                onSubmit={handleSubmit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#212121',
                  borderRadius: '32px',
                  padding: '8px 12px 8px 14px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {}}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#2f2f2f',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>

                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask Jarvis..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '15px',
                    padding: '0 14px',
                    fontFamily: 'inherit'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsDeepThink(!isDeepThink)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: isDeepThink ? 'rgba(99, 102, 241, 0.25)' : '#2f2f2f',
                      border: isDeepThink ? '1px solid #6366f1' : '1px solid transparent',
                      color: isDeepThink ? '#a5b4fc' : '#d1d5db',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    Think
                  </button>

                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isLoading}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#2563eb',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: inputQuery.trim() ? 'pointer' : 'default',
                      opacity: inputQuery.trim() ? 1 : 0.8
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
                  </button>
                </div>
              </form>
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                Jarvis can make mistakes. Verify critical actions with human confirmation.
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 4. CITATION DETAILS MODAL                                                 */}
      {/* ========================================================================= */}
      {activeCitation && (
        <div
          onClick={() => setActiveCitation(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '600px',
              width: '100%',
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '24px',
              color: '#f4f4f5',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '600', color: '#60a5fa' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Certified Source Citation
              </div>
              <button
                onClick={() => setActiveCitation(null)}
                style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ background: '#27272a', padding: '12px 16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', color: '#93c5fd', marginBottom: '16px', wordBreak: 'break-all' }}>
              {activeCitation}
            </div>
            <p style={{ fontSize: '13.5px', color: '#d4d4d8', lineHeight: '1.6', margin: 0 }}>
              This breadcrumb represents a certified corporate policy or standard operating procedure indexed in the <strong>Supabase pgvector</strong> memory layer. All extracted assertions are tamper-evident and grounded in versioned Markdown sources.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={() => setActiveCitation(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: '500', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

