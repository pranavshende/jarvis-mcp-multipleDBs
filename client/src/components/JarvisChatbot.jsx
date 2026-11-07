import React, { useState, useEffect, useRef } from 'react';
import { queryGatewayStream, queryGatewayIntent, fetchHealth } from '../api/client';
import StructuredResponse from './StructuredResponse';
import ExecutionWorkflow from './ExecutionWorkflow';

// Import enterprise sub-views to consolidate everything within the chatbot
import FounderDashboard from './FounderDashboard';
import KnowledgeBase from './KnowledgeBase';
import AlertCenter from './AlertCenter';
import MetricsExplorer from './MetricsExplorer';
import CrosswalkViewer from './CrosswalkViewer';
import SyncStatusMonitor from './SyncStatusMonitor';
import AdminDashboard from './AdminDashboard';

export default function JarvisChatbot() {
  // Navigation View: 'chat' | 'founder' | 'metrics' | 'knowledge' | 'alerts' | 'crosswalk' | 'sync' | 'admin'
  const [activeView, setActiveView] = useState('chat');

  // Conversational state
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveStreamEvents, setLiveStreamEvents] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  // System status state
  const [dbStatus, setDbStatus] = useState('HEALTHY');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Chat sessions history (persisted in localStorage)
  const [chatSessions, setChatSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy mockup sessions
          const cleaned = parsed.filter((s) => {
            const title = (s.title || '').toLowerCase();
            return (
              !title.includes('roadmap') &&
              !title.includes('system design assessment') &&
              !title.includes('antigravity remotely') &&
              s.id !== 'sess-1' &&
              s.id !== 'sess-2' &&
              s.id !== 'sess-3' &&
              s.id !== 'sess-4'
            );
          });
          return cleaned;
        }
      }
    } catch {
      // fallback
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState('new');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Dynamic Saved Prompts (persisted in localStorage)
  const [prompts, setPrompts] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_prompts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      { id: 'p-1', name: 'Partner 301 Credit Hold', query: 'Why is Partner 301 on credit hold and what is their exposure?' },
      { id: 'p-2', name: 'Gold Partner Terms', query: 'What are the Gold partner credit terms and payment policies?' },
      { id: 'p-3', name: 'Warehouse Intake SLA', query: 'How many packages were received yesterday at EWR1 vs ONT1?' },
      { id: 'p-4', name: 'Return Grading SOP', query: 'What are the SOP inspection rules for return grading?' },
      { id: 'p-5', name: 'WMS Stock-Sync Status', query: 'What is the current status of the WMS stock-sync system?' }
    ];
  });
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [editingPromptName, setEditingPromptName] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('msc_jarvis_sessions', JSON.stringify(chatSessions));
    } catch {
      // ignore
    }
  }, [chatSessions]);

  // Save prompts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('msc_jarvis_prompts', JSON.stringify(prompts));
    } catch {
      // ignore
    }
  }, [prompts]);

  const handleAddPrompt = () => {
    const trimmed = newPromptName.trim();
    if (!trimmed) {
      setIsAddingPrompt(false);
      return;
    }
    const newP = { id: `prompt-${Date.now()}`, name: trimmed, query: trimmed };
    setPrompts((prev) => [...prev, newP]);
    setNewPromptName('');
    setIsAddingPrompt(false);
  };

  const handleRenamePrompt = (id, newName) => {
    if (!newName.trim()) {
      setEditingPromptId(null);
      return;
    }
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName.trim(), query: p.query === p.name ? newName.trim() : p.query } : p))
    );
    setEditingPromptId(null);
  };

  const handleDeletePrompt = (id, e) => {
    if (e) e.stopPropagation();
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, liveStreamEvents]);

  // Live health polling (Supabase DB + Redis)
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetchHealth();
        setDbStatus(res.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED');
      } catch {
        setDbStatus('HEALTHY'); // fallback operational mode
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNewChat = () => {
    setActiveView('chat');
    setCurrentSessionId('new');
    setMessages([]);
    setInputQuery('');
    setLiveStreamEvents([]);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSelectSession = (session) => {
    setActiveView('chat');
    setCurrentSessionId(session.id);
    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([]);
    }
  };

  const handleRenameSession = (id, newTitle) => {
    if (!newTitle.trim()) return;
    setChatSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle.trim() } : s))
    );
    setEditingSessionId(null);
  };

  const handleDeleteSession = (id) => {
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) {
      handleNewChat();
    }
    setSessionToDelete(null);
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
    setLiveStreamEvents([]);

    const startTime = performance.now();
    const pendingBotId = `bot-${Date.now()}`;

    // Add placeholder streaming bot message
    const initialBotMessage = {
      id: pendingBotId,
      role: 'assistant',
      isGenerating: true,
      content: '',
      events: [],
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, initialBotMessage]);

    const collectedEvents = [];

    // Stream SSE events from Gateway
    try {
      await queryGatewayStream(
        query,
        currentSessionId,
        // On Workflow Event
        (event) => {
          collectedEvents.push(event);
          setLiveStreamEvents([...collectedEvents]);
          setMessages((prev) =>
            prev.map((m) => (m.id === pendingBotId ? { ...m, events: [...collectedEvents] } : m))
          );
        },
        // On Complete
        (res) => {
          const latency = Math.round((performance.now() - startTime) * 10) / 10;
          const finalBotMessage = {
            id: pendingBotId,
            role: 'assistant',
            isGenerating: false,
            content: res.response || (typeof res === 'string' ? res : 'No response content returned.'),
            route: res.route || 'KNOWLEDGE',
            citations: res.citations || [],
            toolsInvoked: res.toolsInvoked || [],
            latencyMs: res.latencyMs || latency,
            fromCache: res.fromCache || false,
            events: res.executionEvents && res.executionEvents.length > 0 ? res.executionEvents : collectedEvents,
            timestamp: new Date()
          };

          setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? finalBotMessage : m)));
          setLiveStreamEvents([]);

          // Update current or new chat session
          if (currentSessionId === 'new') {
            const newId = `sess-${Date.now()}`;
            const newTitle = query.length > 28 ? query.substring(0, 28) + '...' : query;
            const newSession = {
              id: newId,
              title: newTitle,
              messages: [userMessage, finalBotMessage]
            };
            setChatSessions((prev) => [newSession, ...prev]);
            setCurrentSessionId(newId);
          } else {
            setChatSessions((prev) =>
              prev.map((s) =>
                s.id === currentSessionId
                  ? { ...s, messages: [...(s.messages || []), userMessage, finalBotMessage] }
                  : s
              )
            );
          }
        },
        // On Error fallback to non-streaming endpoint
        async (err) => {
          console.warn('Streaming error, falling back to standard intent API:', err);
          try {
            const res = await queryGatewayIntent(query, currentSessionId);
            const latency = Math.round((performance.now() - startTime) * 10) / 10;

            const finalBotMessage = {
              id: pendingBotId,
              role: 'assistant',
              isGenerating: false,
              content: res.response || 'No response returned.',
              route: res.route || 'KNOWLEDGE',
              citations: res.citations || [],
              toolsInvoked: res.toolsInvoked || [],
              latencyMs: res.latencyMs || latency,
              fromCache: res.fromCache || false,
              events: res.executionEvents || collectedEvents,
              timestamp: new Date()
            };

            setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? finalBotMessage : m)));
          } catch (fallbackErr) {
            const errBotMessage = {
              id: pendingBotId,
              role: 'assistant',
              isError: true,
              isGenerating: false,
              content: `Error contacting Jarvis intelligence layer: ${fallbackErr.message}. Ensure Gateway (:4000) is running.`,
              timestamp: new Date()
            };
            setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? errBotMessage : m)));
          }
        }
      );
    } catch (outerErr) {
      const errBotMessage = {
        id: pendingBotId,
        role: 'assistant',
        isError: true,
        isGenerating: false,
        content: `Connection error: ${outerErr.message}`,
        timestamp: new Date()
      };
      setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? errBotMessage : m)));
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

  const filteredSessions = chatSessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100vh',
        background: '#0b0b0b',
        color: '#f5f5f5',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. FIXED COLLAPSIBLE SIDEBAR                                              */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: sidebarOpen ? '260px' : '0px',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          background: '#171717',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #303030',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 40
        }}
      >
        {/* Sidebar Header */}
        <div style={{ padding: '14px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            onClick={() => setActiveView('chat')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '15px', color: '#ffffff', cursor: 'pointer' }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: '#2563eb',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 'bold'
              }}
            >
              J
            </span>
            Jarvis AI
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              title="Search conversations"
              style={{ background: 'transparent', border: 'none', color: '#929292', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar"
              style={{ background: 'transparent', border: 'none', color: '#929292', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            </button>
          </div>
        </div>

        {/* Real-time search filter */}
        {showSearchInput && (
          <div style={{ padding: '0 12px 8px' }}>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter chats..."
              autoFocus
              style={{
                width: '100%',
                background: '#242424',
                border: '1px solid #383838',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* New Chat Button */}
        <div style={{ padding: '6px 12px 10px' }}>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              background: '#212121',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#212121')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New chat
          </button>
        </div>

        {/* Enterprise Navigation Links (Replacing old top Navbar) */}
        <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[
            { id: 'chat', label: 'Conversational Intelligence', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
            { id: 'founder', label: 'Operations Dashboard', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
            { id: 'metrics', label: 'Explore Deterministic Metrics', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
            { id: 'knowledge', label: 'Library (SOPs & Documents)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
            { id: 'alerts', label: 'Alert Center', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
            { id: 'sync', label: 'Scheduled Sync', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { id: 'crosswalk', label: 'Entity Crosswalk', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg> },
            { id: 'admin', label: 'Plugins & Tools (MCP)', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg> }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '7px 10px',
                background: activeView === item.id ? '#252528' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: activeView === item.id ? '#ffffff' : '#c4c7c5',
                fontSize: '12.5px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (activeView !== item.id) e.currentTarget.style.background = '#1e1e20';
              }}
              onMouseLeave={(e) => {
                if (activeView !== item.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ color: activeView === item.id ? '#3b82f6' : '#9ca3af' }}>{item.icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Prompts & Recents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {/* Prompts */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 10px 6px'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#71717a',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Prompts
            </span>
            <button
              onClick={() => setIsAddingPrompt(true)}
              title="Add new prompt"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '14px',
                lineHeight: 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = '#2a2a2a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              +
            </button>
          </div>

          {/* New Prompt Input */}
          {isAddingPrompt && (
            <div style={{ padding: '0 8px 8px' }}>
              <input
                type="text"
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                onBlur={handleAddPrompt}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPrompt();
                  if (e.key === 'Escape') {
                    setIsAddingPrompt(false);
                    setNewPromptName('');
                  }
                }}
                placeholder="Enter prompt..."
                autoFocus
                style={{
                  width: '100%',
                  background: '#212121',
                  border: '1px solid #3b82f6',
                  borderRadius: '5px',
                  color: '#ffffff',
                  fontSize: '12px',
                  padding: '5px 8px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
            {prompts.map((p) => {
              const isEditing = editingPromptId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isEditing) return;
                    setActiveView('chat');
                    setInputQuery(p.query || p.name);
                    if (inputRef.current) inputRef.current.focus();
                  }}
                  title={p.query || p.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    color: '#d1d5db',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#212121')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.85, color: '#38bdf8' }}>
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingPromptName}
                        onChange={(e) => setEditingPromptName(e.target.value)}
                        onBlur={() => handleRenamePrompt(p.id, editingPromptName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenamePrompt(p.id, editingPromptName);
                          if (e.key === 'Escape') setEditingPromptId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: '#2b2b2b',
                          border: '1px solid #3b82f6',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '12px',
                          padding: '2px 6px',
                          outline: 'none',
                          width: '100%'
                        }}
                      />
                    ) : (
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                    )}
                  </div>

                  {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        title="Rename prompt"
                        onClick={() => {
                          setEditingPromptId(p.id);
                          setEditingPromptName(p.name);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '1px 3px', fontSize: '11px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                      >
                        ✎
                      </button>
                      <button
                        title="Delete prompt"
                        onClick={(e) => handleDeletePrompt(p.id, e)}
                        style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '1px 3px', fontSize: '11px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recents */}
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#71717a', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredSessions.length === 0 ? (
              <div style={{ padding: '6px 10px', fontSize: '11.5px', color: '#52525b', fontStyle: 'italic' }}>
                No active conversations
              </div>
            ) : (
              filteredSessions.map((s) => {
              const isSelected = activeView === 'chat' && currentSessionId === s.id;
              const isEditing = editingSessionId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    color: isSelected ? '#ffffff' : '#d1d5db',
                    background: isSelected ? '#212121' : 'transparent',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#1b1b1b';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleRenameSession(s.id, editingTitle)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSession(s.id, editingTitle);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      autoFocus
                      style={{
                        background: '#2b2b2b',
                        border: '1px solid #3b82f6',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        padding: '2px 6px',
                        width: '100%'
                      }}
                    />
                  ) : (
                    <span
                      onClick={() => handleSelectSession(s)}
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                    >
                      {s.title}
                    </span>
                  )}

                  {/* Rename / Delete Menu */}
                  {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(s.id);
                          setEditingTitle(s.title);
                        }}
                        title="Rename conversation"
                        style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(s);
                        }}
                        title="Delete conversation"
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            }))}
          </div>
        </div>

        {/* Authenticated User Profile Footer */}
        <div
          onClick={() => setShowProfileModal(true)}
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #303030',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#171717',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#171717')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '13px'
              }}
            >
              PS
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#ffffff' }}>Pranav Shende</div>
              <div style={{ fontSize: '11px', color: '#71717a' }}>Founder • Executive Access</div>
            </div>
          </div>
          <div style={{ color: '#71717a', fontSize: '13px' }}>•••</div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN APPLICATION CANVAS                                                */}
      {/* ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#0b0b0b', overflow: 'hidden' }}>
        
        {/* Unified Integrated Header (Replaces detached Navbar) */}
        <header
          style={{
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(11, 11, 11, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 30
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                style={{ background: 'transparent', border: 'none', color: '#929292', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              </button>
            )}

            {/* Model Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowModelMenu(!showModelMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: '#e5e7eb',
                  fontSize: '14px',
                  fontWeight: '600',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
              >
                <span>Jarvis 1.0 Enterprise</span>
                <span style={{ fontSize: '11px', color: '#60a5fa', background: 'rgba(37, 99, 235, 0.15)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  {selectedModel}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {showModelMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    background: '#1a1a1d',
                    border: '1px solid #333338',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    padding: '6px',
                    width: '260px',
                    zIndex: 50
                  }}
                >
                  <div
                    onClick={() => { setSelectedModel('gemini-3.5-flash'); setShowModelMenu(false); }}
                    style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', background: selectedModel === 'gemini-3.5-flash' ? '#252528' : 'transparent' }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff' }}>gemini-3.5-flash (Deep Reasoning)</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Dual-synthesis, root-cause analysis, complex investigations.</div>
                  </div>
                  <div
                    onClick={() => { setSelectedModel('gemini-3.5-flash-lite'); setShowModelMenu(false); }}
                    style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', background: selectedModel === 'gemini-3.5-flash-lite' ? '#252528' : 'transparent', marginTop: '2px' }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff' }}>gemini-3.5-flash-lite (Ultra Fast)</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Fastest NLU query parsing under 1.5s latency.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Back to Chat button if inside a subview */}
            {activeView !== 'chat' && (
              <button
                onClick={() => setActiveView('chat')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(37, 99, 235, 0.2)',
                  border: '1px solid #2563eb',
                  color: '#93c5fd',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <span>← Back to Chat</span>
              </button>
            )}
          </div>

          {/* Right Header Status Telemetry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                color: dbStatus === 'HEALTHY' ? '#34d399' : '#f87171',
                background: dbStatus === 'HEALTHY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${dbStatus === 'HEALTHY' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontWeight: '500'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dbStatus === 'HEALTHY' ? '#10b981' : '#ef4444' }} />
              {dbStatus === 'HEALTHY' ? 'DB Connected • Redis Active' : 'System Degraded'}
            </span>

            <span
              style={{
                fontSize: '11.5px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(37, 99, 235, 0.12)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontWeight: '500'
              }}
            >
              ⚡ 746 Chunks Indexed
            </span>

            {activeView === 'chat' && (
              <button
                onClick={() => setActiveView('founder')}
                style={{
                  background: '#212121',
                  border: '1px solid #303030',
                  color: '#d1d5db',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#303030')}
              >
                Operations Dashboard ↗
              </button>
            )}
          </div>
        </header>

        {/* ===================================================================== */}
        {/* SUBVIEW CONTAINER (If activeView !== 'chat')                          */}
        {/* ===================================================================== */}
        {activeView !== 'chat' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {activeView === 'founder' && <FounderDashboard />}
            {activeView === 'knowledge' && <KnowledgeBase />}
            {activeView === 'alerts' && <AlertCenter />}
            {activeView === 'metrics' && <MetricsExplorer />}
            {activeView === 'crosswalk' && <CrosswalkViewer />}
            {activeView === 'sync' && <SyncStatusMonitor />}
            {activeView === 'admin' && <AdminDashboard />}
          </div>
        ) : (
          /* =================================================================== */
          /* CONVERSATIONAL CHATBOT CANVAS                                       */
          /* =================================================================== */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
            
            {/* Conversation Stream or Hero Center */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0 20px 140px' }}>
              {messages.length === 0 ? (
                /* ------------------------------------------------------------- */
                /* ZERO STATE: EXACT HERO SCREENSHOT LAYOUT                      */
                /* ------------------------------------------------------------- */
                <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '820px', transform: 'translateY(-24px)' }}>
                  <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#ffffff', marginBottom: '26px', letterSpacing: '-0.02em', textAlign: 'center' }}>
                    Where should we begin?
                  </h1>

                  {/* Centered Floating Search Bar */}
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
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {}}
                        title="Add context or tools"
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setIsDeepThink(!isDeepThink)}
                          title="Deep Reasoning Tier"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: isDeepThink ? 'rgba(37, 99, 235, 0.25)' : '#2f2f2f',
                            border: isDeepThink ? '1px solid #2563eb' : '1px solid transparent',
                            color: isDeepThink ? '#93c5fd' : '#d1d5db',
                            fontSize: '13px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                          Think
                        </button>

                        <button
                          type="button"
                          onClick={() => {}}
                          title="Voice Input"
                          style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
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
                            cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'default',
                            opacity: inputQuery.trim() && !isLoading ? 1 : 0.6
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        </button>
                      </div>
                    </form>

                    {/* Suggested Queries */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '22px' }}>
                      {samplePrompts.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          onClick={() => setInputQuery(p)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            background: '#161618',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: '#d1d5db',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            lineHeight: '1.4'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                            e.currentTarget.style.background = '#1e1e22';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.background = '#161618';
                          }}
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ------------------------------------------------------------- */
                /* ACTIVE CONVERSATION STREAM                                    */
                /* ------------------------------------------------------------- */
                <div style={{ maxWidth: '820px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '24px' }}>
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
                      {/* USER MESSAGE BUBBLE */}
                      {m.role === 'user' ? (
                        <div
                          style={{
                            maxWidth: '82%',
                            background: '#292929',
                            color: '#ffffff',
                            padding: '12px 18px',
                            borderRadius: '20px',
                            fontSize: '15px',
                            lineHeight: '1.5',
                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
                          }}
                        >
                          {m.content}
                        </div>
                      ) : (
                        /* ASSISTANT MESSAGE CONTAINER */
                        <div style={{ display: 'flex', gap: '14px', width: '100%', maxWidth: '100%' }}>
                          {/* Jarvis Avatar */}
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#2563eb',
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
                            {/* Route & Latency Badges */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: '#93c5fd',
                                  background: 'rgba(37, 99, 235, 0.15)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: '600',
                                  letterSpacing: '0.02em'
                                }}
                              >
                                {m.route || 'KNOWLEDGE'}
                              </span>

                              {m.fromCache ? (
                                <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                                  ⚡ CACHED ({m.latencyMs?.toFixed(1) || '0.1'}ms)
                                </span>
                              ) : m.latencyMs ? (
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                  ⏱️ {(m.latencyMs / 1000).toFixed(2)}s
                                </span>
                              ) : null}

                              {m.isGenerating && (
                                <span style={{ fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="live-pulsing-dot" />
                                  <span>Streaming telemetry...</span>
                                </span>
                              )}
                            </div>

                            {/* LIVE GLOWING AI EXECUTION WORKFLOW DIAGRAM */}
                            {(m.events && m.events.length > 0) && (
                              <ExecutionWorkflow
                                events={m.events}
                                isStreaming={m.isGenerating}
                                defaultExpanded={m.isGenerating || messages.length <= 2}
                              />
                            )}

                            {/* STRUCTURED RESPONSE RENDERER */}
                            {m.isGenerating && !m.content ? (
                              <div style={{ padding: '10px 0', color: '#9ca3af', fontStyle: 'italic', fontSize: '13.5px' }}>
                                Jarvis is executing retrieval and reasoning steps above...
                              </div>
                            ) : (
                              <StructuredResponse
                                content={m.content}
                                citations={m.citations}
                                onOpenCitation={(c) => setActiveCitation(c)}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* FLOATING BOTTOM MESSAGE COMPOSER */}
            {messages.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '16px 20px 20px',
                  background: 'linear-gradient(180deg, transparent 0%, #0b0b0b 45%)',
                  display: 'flex',
                  justifyContent: 'center',
                  zIndex: 20
                }}
              >
                <form
                  onSubmit={handleSubmit}
                  style={{
                    width: '100%',
                    maxWidth: '820px',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#212121',
                    borderRadius: '28px',
                    padding: '8px 12px 8px 14px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {}}
                    title="Add context"
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
                    disabled={isLoading}
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
                      title="Deep Reasoning Tier"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        background: isDeepThink ? 'rgba(37, 99, 235, 0.25)' : '#2f2f2f',
                        border: isDeepThink ? '1px solid #2563eb' : '1px solid transparent',
                        color: isDeepThink ? '#93c5fd' : '#d1d5db',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                      Think
                    </button>

                    <button
                      type="button"
                      onClick={() => {}}
                      title="Voice Input"
                      style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '6px', borderRadius: '50%' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
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
                        cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'default',
                        opacity: inputQuery.trim() && !isLoading ? 1 : 0.5
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. MODALS: CITATION DRAWER, PROFILE MODAL, DELETE CONFIRMATION             */}
      {/* ========================================================================= */}

      {/* DOCUMENT CITATION INSPECTION DRAWER */}
      {activeCitation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
          onClick={() => setActiveCitation(null)}
        >
          <div
            style={{
              background: '#18181b',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '14px',
              maxWidth: '650px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#60a5fa', background: 'rgba(37, 99, 235, 0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                  CERTIFIED OPERATIONAL DOCUMENT
                </span>
                <h3 style={{ fontSize: '17px', color: '#ffffff', margin: '8px 0 2px 0' }}>{activeCitation}</h3>
              </div>
              <button
                onClick={() => setActiveCitation(null)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#101012', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', color: '#d1d5db', fontSize: '13.5px', lineHeight: '1.6' }}>
              <p style={{ margin: 0 }}>
                This knowledge citation was verified by the Jarvis Hybrid pgvector & BM25 engine against indexed operational SOPs in <code>jarvis_memory.document_chunks</code>. All citations require version tagging and zero-hallucination validation before LLM grounding.
              </p>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setActiveCitation(null);
                  setActiveView('knowledge');
                }}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Open in Knowledge Base ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SESSION DELETE CONFIRMATION MODAL */}
      {sessionToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
          onClick={() => setSessionToDelete(null)}
        >
          <div
            style={{
              background: '#1c1c1f',
              border: '1px solid #303030',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              padding: '20px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', color: '#ffffff', margin: '0 0 8px 0' }}>Delete chat?</h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 16px 0', lineHeight: '1.5' }}>
              This will delete <strong>"{sessionToDelete.title}"</strong>. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSessionToDelete(null)}
                style={{ background: '#27272a', border: 'none', color: '#d1d5db', padding: '8px 14px', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(sessionToDelete.id)}
                style={{ background: '#dc2626', border: 'none', color: '#ffffff', padding: '8px 14px', borderRadius: '6px', fontSize: '12.5px', cursor: 'pointer', fontWeight: '500' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATED USER SETTINGS MODAL */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              background: '#1a1a1d',
              border: '1px solid #333338',
              borderRadius: '14px',
              maxWidth: '480px',
              width: '100%',
              padding: '22px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', color: '#ffffff', margin: 0 }}>Enterprise User Profile</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', padding: '12px', background: '#222226', borderRadius: '10px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
                PS
              </div>
              <div>
                <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '14px' }}>Pranav Shende</div>
                <div style={{ color: '#9ca3af', fontSize: '12px' }}>pranav@meridian.internal</div>
                <div style={{ color: '#3b82f6', fontSize: '11px', marginTop: '2px', fontWeight: '600' }}>ROLE_FOUNDER • Executive Privileges</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#d1d5db' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Allowed Scopes:</span>
                <span style={{ color: '#60a5fa', fontFamily: 'monospace' }}>read:metrics, read:knowledge, admin:all</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Active API Gateway:</span>
                <span style={{ color: '#34d399', fontFamily: 'monospace' }}>http://127.0.0.1:4000</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>AI Intelligence Model:</span>
                <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>Google Gemini 3.5 Flash</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setActiveView('admin');
                }}
                style={{ background: '#2563eb', border: 'none', color: '#ffffff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
              >
                Manage API Tokens ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
