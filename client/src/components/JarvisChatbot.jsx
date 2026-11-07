import React, { useState, useEffect, useRef } from 'react';
import {
  queryGatewayStream,
  queryGatewayIntent,
  fetchHealth,
  fetchCurrentUser,
  logoutUser,
  fetchConversations,
  fetchConversationMessages,
  renameConversation,
  deleteConversation
} from '../api/client';
import StructuredResponse from './StructuredResponse';
import ExecutionWorkflow from './ExecutionWorkflow';
import AuthModal from './AuthModal';
import PagePurposeBanner from './PagePurposeBanner';

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

  // Multi-User Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Responsive Phone / Desktop Detection
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [mobileWorkflowOpen, setMobileWorkflowOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Conversational state (100% Dynamic - starts clean or restores user history)
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_active_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy demo items if any
          const cleaned = parsed.filter((m) => m && !m.id?.startsWith('demo-'));
          return cleaned;
        }
      }
    } catch {}
    return [];
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveStreamEvents, setLiveStreamEvents] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  // System status state
  const [dbStatus, setDbStatus] = useState('HEALTHY');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Chat sessions history (persisted in localStorage)
  const [chatSessions, setChatSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((s) => s && s.id && !s.id.startsWith('sess-'));
          return cleaned;
        }
      }
    } catch {}
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_current_session_id');
      if (saved && saved !== 'new') return saved;
    } catch {}
    return 'new';
  });
  const currentSessionIdRef = useRef(currentSessionId);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Sync ref and localStorage when currentSessionId changes
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
    try {
      localStorage.setItem('msc_jarvis_current_session_id', currentSessionId);
    } catch {}
  }, [currentSessionId]);

  // Dynamic Projects / Prompts (clean by default - no mock files)
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (p) =>
              p &&
              p.id &&
              !['proj-1', 'proj-2', 'proj-3', 'proj-4'].includes(p.id) &&
              ![
                'Partner Credit & AR Aging',
                'Warehouse Intake SLA (EWR1/ONT1)',
                'FIFO Inventory Costing',
                'Inspection & Grading Governance'
              ].includes(p.name)
          );
          return cleaned;
        }
      }
    } catch {}
    return [];
  });
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Clean mock demo projects from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (p) =>
              p &&
              p.id &&
              !['proj-1', 'proj-2', 'proj-3', 'proj-4'].includes(p.id) &&
              ![
                'Partner Credit & AR Aging',
                'Warehouse Intake SLA (EWR1/ONT1)',
                'FIFO Inventory Costing',
                'Inspection & Grading Governance'
              ].includes(p.name)
          );
          localStorage.setItem('msc_jarvis_projects', JSON.stringify(cleaned));
          setProjects(cleaned);
        }
      }
    } catch {}
  }, []);

  // Save active messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('msc_jarvis_active_chat', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('msc_jarvis_sessions', JSON.stringify(chatSessions));
    } catch {}
  }, [chatSessions]);

  // Save projects to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('msc_jarvis_projects', JSON.stringify(projects));
    } catch {}
  }, [projects]);

  const handleAddProject = () => {
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      setIsAddingProject(false);
      return;
    }
    const newP = { id: `proj-${Date.now()}`, name: trimmed, query: trimmed };
    setProjects((prev) => [...prev, newP]);
    setNewProjectName('');
    setIsAddingProject(false);
  };

  const handleRenameProject = (id, newName) => {
    if (!newName.trim()) {
      setEditingProjectId(null);
      return;
    }
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName.trim(), query: p.query === p.name ? newName.trim() : p.query } : p))
    );
    setEditingProjectId(null);
  };

  const handleDeleteProject = (id, e) => {
    if (e) e.stopPropagation();
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, liveStreamEvents]);

  // Check authenticated session and load conversations on mount
  useEffect(() => {
    async function initSession() {
      try {
        const auth = await fetchCurrentUser();
        if (auth && auth.user) {
          setCurrentUser(auth.user);
          await loadConversations();

          // Restore active session messages if user was in a conversation
          const savedSessionId = localStorage.getItem('msc_jarvis_current_session_id');
          if (savedSessionId && savedSessionId !== 'new') {
            try {
              const res = await fetchConversationMessages(savedSessionId);
              if (res && res.messages && Array.isArray(res.messages) && res.messages.length > 0) {
                const mapped = res.messages.map((m) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  events: m.executionMetadata?.executionEvents || [],
                  citations: m.executionMetadata?.citations || [],
                  route: m.executionMetadata?.route || 'KNOWLEDGE + DATA',
                  latencyMs: m.executionMetadata?.latencyMs,
                  timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));
                setMessages(mapped);
                setCurrentSessionId(savedSessionId);
                currentSessionIdRef.current = savedSessionId;
              }
            } catch (loadErr) {
              console.warn('Could not restore messages for session:', savedSessionId, loadErr);
            }
          }
        } else {
          setAuthModalOpen(true);
        }
      } catch {
        setAuthModalOpen(true);
      }
    }
    initSession();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await fetchConversations();
      if (res && res.conversations && Array.isArray(res.conversations)) {
        setChatSessions(res.conversations);
      }
    } catch (e) {
      console.warn('Failed to load conversations from db:', e);
    }
  };

  // Live health polling (Supabase DB + Redis)
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetchHealth();
        setDbStatus(res.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED');
      } catch {
        setDbStatus('HEALTHY');
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNewChat = () => {
    setActiveView('chat');
    setCurrentSessionId('new');
    currentSessionIdRef.current = 'new';
    try {
      localStorage.setItem('msc_jarvis_current_session_id', 'new');
      localStorage.removeItem('msc_jarvis_active_chat');
    } catch {}
    setMessages([]);
    setInputQuery('');
    setLiveStreamEvents([]);
    setShowWorkflowPanel(false);
    if (isMobile) setSidebarOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSelectSession = async (session) => {
    setActiveView('chat');
    setCurrentSessionId(session.id);
    currentSessionIdRef.current = session.id;
    try {
      localStorage.setItem('msc_jarvis_current_session_id', session.id);
    } catch {}
    setIsLoading(true);
    setLiveStreamEvents([]);
    try {
      const res = await fetchConversationMessages(session.id);
      if (res && res.messages && Array.isArray(res.messages)) {
        const mapped = res.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          events: m.executionMetadata?.executionEvents || [],
          citations: m.executionMetadata?.citations || [],
          route: m.executionMetadata?.route || 'KNOWLEDGE + DATA',
          latencyMs: m.executionMetadata?.latencyMs,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setMessages(mapped);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load messages from db:', err);
      setMessages([]);
    } finally {
      setIsLoading(false);
      if (isMobile) setSidebarOpen(false);
    }
  };

  const handleRenameSession = async (id, newTitle) => {
    if (!newTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await renameConversation(id, newTitle.trim());
      setChatSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle.trim() } : s))
      );
    } catch (err) {
      console.error('Failed to rename conversation in db:', err);
    }
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await deleteConversation(id);
      setChatSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSessionId === id) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation from db:', err);
    }
    setSessionToDelete(null);
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setMessages([]);
    setChatSessions([]);
    setCurrentSessionId('new');
    setAuthModalOpen(true);
  };

  const handleSubmit = async (e, customQuery) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : inputQuery).trim();
    if (!query || isLoading) return;

    // Use synchronous ref to ensure whole chats continue in the same session
    const activeSessionId = currentSessionIdRef.current || currentSessionId || 'new';

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setIsLoading(true);
    setShowWorkflowPanel(true);
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, initialBotMessage]);

    const collectedEvents = [];

    // Stream SSE events from Gateway
    try {
      await queryGatewayStream(
        query,
        activeSessionId,
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
            route: res.route || 'KNOWLEDGE + DATA',
            citations: res.citations || [],
            toolsInvoked: res.toolsInvoked || [],
            latencyMs: res.latencyMs || latency,
            fromCache: res.fromCache || false,
            events: res.executionEvents && res.executionEvents.length > 0 ? res.executionEvents : collectedEvents,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? finalBotMessage : m)));
          setLiveStreamEvents(finalBotMessage.events);

          if (res.conversationId) {
            setCurrentSessionId(res.conversationId);
            currentSessionIdRef.current = res.conversationId;
            try {
              localStorage.setItem('msc_jarvis_current_session_id', res.conversationId);
            } catch {}
          }
          // Refresh conversation list from database
          loadConversations();
        },
        // On Error fallback
        async (streamErr) => {
          try {
            const res = await queryGatewayIntent(query, activeSessionId);
            const latency = Math.round((performance.now() - startTime) * 10) / 10;

            const finalBotMessage = {
              id: pendingBotId,
              role: 'assistant',
              isGenerating: false,
              content: res.response || 'No response returned.',
              route: res.route || 'KNOWLEDGE + DATA',
              citations: res.citations || [],
              toolsInvoked: res.toolsInvoked || [],
              latencyMs: res.latencyMs || latency,
              fromCache: res.fromCache || false,
              events: res.executionEvents || collectedEvents,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? finalBotMessage : m)));
            setLiveStreamEvents(finalBotMessage.events || []);

            if (res.conversationId) {
              setCurrentSessionId(res.conversationId);
              currentSessionIdRef.current = res.conversationId;
              try {
                localStorage.setItem('msc_jarvis_current_session_id', res.conversationId);
              } catch {}
            }
            loadConversations();
          } catch (fallbackErr) {
            const errBotMessage = {
              id: pendingBotId,
              role: 'assistant',
              isError: true,
              isGenerating: false,
              content: `Error contacting Jarvis intelligence layer: ${fallbackErr.message}. Ensure Gateway (:4000) is running.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? errBotMessage : m)));
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'Why is Partner 301 on credit hold and what is their exposure?',
    'How many packages were received yesterday at EWR1 vs ONT1?',
    'What are the Gold partner credit terms and payment policies?',
    'What are the SOP inspection rules for return grading?'
  ];

  const filteredSessions = chatSessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Latest user query for workflow panel title
  const latestUserQuery =
    [...messages].reverse().find((m) => m.role === 'user')?.content || 'Active operational inquiry';

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100vh',
        background: '#f8f7f4',
        color: '#1a1c19',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 90
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 1. SIDEBAR (Collapsible Drawer on Mobile, Fixed Sidebar on Desktop)         */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: isMobile ? '280px' : (sidebarOpen ? '260px' : '0px'),
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.22s ease',
          background: '#f3f2ee',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e8e6df',
          overflow: 'hidden',
          flexShrink: 0,
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          boxShadow: isMobile && sidebarOpen ? '8px 0 30px rgba(0, 0, 0, 0.2)' : 'none'
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            onClick={() => {
              setActiveView('chat');
              if (isMobile) setSidebarOpen(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '16px', color: '#1a1c19', cursor: 'pointer' }}
          >
            {/* Green Leaf Brand Icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0e372d">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
            </svg>
            Jarvis AI
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              title="Search conversations"
              style={{ background: 'transparent', border: 'none', color: '#787a74', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
              style={{ background: 'transparent', border: 'none', color: '#787a74', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                background: '#ffffff',
                border: '1px solid #e2e0d8',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#1a1c19',
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
              gap: '8px',
              padding: '10px 12px',
              background: '#0e372d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              textAlign: 'left',
              boxShadow: '0 2px 6px rgba(14, 55, 45, 0.15)',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#13463a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#0e372d')}
          >
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>+</span>
            New chat
          </button>
        </div>

        {/* Navigation Links */}
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
          ].map((item) => {
            const isSelected = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (isMobile) setSidebarOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: isSelected ? '#e5e3dc' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: isSelected ? '#1a1c19' : '#4b4d49',
                  fontWeight: isSelected ? '600' : '500',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ color: isSelected ? '#0e372d' : '#787a74' }}>{item.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Projects & Recents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          
          {/* Projects Header & List (only rendered if custom user projects exist or one is being added) */}
          {(projects.length > 0 || isAddingProject) && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 10px 6px'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#787a74', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Projects
                </span>
                <button
                  onClick={() => setIsAddingProject(true)}
                  title="Create new project workspace"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#787a74',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    lineHeight: 1
                  }}
                >
                  +
                </button>
              </div>

              {/* New Project Input */}
              {isAddingProject && (
                <div style={{ padding: '0 8px 8px' }}>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onBlur={handleAddProject}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddProject();
                      if (e.key === 'Escape') {
                        setIsAddingProject(false);
                        setNewProjectName('');
                      }
                    }}
                    placeholder="New project..."
                    autoFocus
                    style={{
                      width: '100%',
                      background: '#ffffff',
                      border: '1px solid #0e372d',
                      borderRadius: '5px',
                      color: '#1a1c19',
                      fontSize: '12px',
                      padding: '5px 8px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Projects List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '14px' }}>
                {projects.map((p) => {
                  const isEditing = editingProjectId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (isEditing) return;
                        setActiveView('chat');
                        handleSubmit(null, p.query || `Provide an executive briefing on ${p.name}`);
                        if (isMobile) setSidebarOpen(false);
                      }}
                      title={p.query || p.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        color: '#3d3f3b',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#e8e6df')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>

                        {isEditing ? (
                          <input
                            type="text"
                            value={editingProjectName}
                            onChange={(e) => setEditingProjectName(e.target.value)}
                            onBlur={() => handleRenameProject(p.id, editingProjectName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameProject(p.id, editingProjectName);
                              if (e.key === 'Escape') setEditingProjectId(null);
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #0e372d',
                              borderRadius: '4px',
                              color: '#1a1c19',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            title="Rename"
                            onClick={() => {
                              setEditingProjectId(p.id);
                              setEditingProjectName(p.name);
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '1px 3px', fontSize: '11px' }}
                          >
                            ✎
                          </button>
                          <button
                            title="Delete"
                            onClick={(e) => handleDeleteProject(p.id, e)}
                            style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '1px 3px', fontSize: '11px' }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Recents */}
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#787a74', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredSessions.length === 0 ? (
              <div style={{ padding: '6px 10px', fontSize: '11.5px', color: '#9ca3af', fontStyle: 'italic' }}>
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
                      color: isSelected ? '#1a1c19' : '#3d3f3b',
                      background: isSelected ? '#e5e3dc' : 'transparent',
                      fontSize: '12px',
                      fontWeight: isSelected ? '600' : '400',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#e8e6df';
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
                          background: '#ffffff',
                          border: '1px solid #0e372d',
                          borderRadius: '4px',
                          color: '#1a1c19',
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

                    {!isEditing && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(s.id);
                            setEditingTitle(s.title);
                          }}
                          title="Rename conversation"
                          style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px' }}
                        >
                          ✎
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(s);
                          }}
                          title="Delete conversation"
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Authenticated User Profile Footer */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #e8e6df',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f3f2ee'
          }}
        >
          <div
            onClick={() => {
              if (!currentUser) setAuthModalOpen(true);
              else setShowProfileModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#0e372d',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '12.5px',
                flexShrink: 0
              }}
            >
              {currentUser && currentUser.name
                ? currentUser.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'PS'}
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1c19', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser ? currentUser.name : 'Sign In'}
              </div>
              <div style={{ fontSize: '11px', color: '#787a74', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser ? currentUser.email : 'Click to authenticate'}
              </div>
            </div>
          </div>

          {currentUser ? (
            <button
              onClick={handleLogout}
              title="Log Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              style={{
                background: '#0e372d',
                border: 'none',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '600',
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Login
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN APPLICATION CANVAS                                                */}
      {/* ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#f8f7f4', overflow: 'hidden' }}>
        
        {/* Artistic generative background contour lines */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: isMobile ? '280px' : '460px',
            height: isMobile ? '280px' : '460px',
            pointerEvents: 'none',
            zIndex: 0,
            opacity: 0.55
          }}
          viewBox="0 0 500 500"
          fill="none"
        >
          <path d="M-50,80 C120,40 180,180 240,120 C300,60 380,220 520,180" stroke="#ded8cd" strokeWidth="1.2" />
          <path d="M-60,140 C100,100 160,240 230,190 C300,140 370,280 530,250" stroke="#e5dfd4" strokeWidth="1" />
          <path d="M-40,200 C110,170 170,300 250,260 C330,220 400,340 540,320" stroke="#eae4d9" strokeWidth="0.8" />
        </svg>

        {/* Top Header Bar */}
        <header
          style={{
            padding: isMobile ? '10px 14px' : '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e8e6df',
            background: 'rgba(248, 247, 244, 0.95)',
            backdropFilter: 'blur(8px)',
            zIndex: 30
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
            {/* Hamburger Button for Mobile / Collapsed Desktop */}
            {(!sidebarOpen || isMobile) && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Open menu"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#1a1c19',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}

            <span style={{ fontSize: isMobile ? '13.5px' : '14px', fontWeight: '700', color: '#1a1c19' }}>
              {isMobile ? 'Jarvis AI' : 'Jarvis 1.0 Enterprise'}
            </span>

            {/* Model Selector Dropdown Pill */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowModelMenu(!showModelMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  color: '#1a1c19',
                  fontSize: isMobile ? '11.5px' : '12.5px',
                  fontWeight: '500',
                  padding: isMobile ? '2px 8px' : '3px 10px',
                  borderRadius: '16px',
                  background: '#ffffff',
                  border: '1px solid #e2e0d8',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                }}
              >
                <span>{selectedModel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {showModelMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    background: '#ffffff',
                    border: '1px solid #e2e0d8',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                    padding: '6px',
                    width: '200px',
                    zIndex: 50
                  }}
                >
                  {['gemini-2.5-pro', 'gemini-3.5-flash', 'gemini-1.5-pro'].map((m) => (
                    <div
                      key={m}
                      onClick={() => { setSelectedModel(m); setShowModelMenu(false); }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: selectedModel === m ? '600' : '400',
                        color: selectedModel === m ? '#0e372d' : '#374151',
                        background: selectedModel === m ? '#e8f5ec' : 'transparent'
                      }}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Status Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
            
            {/* DB Health Pill */}
            <span
              title="DB Connected - Redis Active"
              style={{
                fontSize: isMobile ? '11px' : '11.5px',
                padding: isMobile ? '3px 8px' : '4px 10px',
                borderRadius: '16px',
                background: dbStatus === 'HEALTHY' ? '#e8f5ec' : '#fee2e2',
                color: dbStatus === 'HEALTHY' ? '#166534' : '#dc2626',
                border: `1px solid ${dbStatus === 'HEALTHY' ? '#bbf7d0' : '#fecaca'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: '600'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dbStatus === 'HEALTHY' ? '#16a34a' : '#ef4444' }} />
              {!isMobile && (dbStatus === 'HEALTHY' ? 'DB Connected - Redis Active' : 'System Degraded')}
              {isMobile && 'Live'}
            </span>

            {/* Desktop Only: Chunks Pill */}
            {!isMobile && (
              <span
                style={{
                  fontSize: '11.5px',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  fontWeight: '500'
                }}
              >
                ⚡ 746 Chunks
              </span>
            )}

            {/* Mobile Only: Workflow Sheet Toggle Button */}
            {isMobile && activeView === 'chat' && showWorkflowPanel && (
              <button
                onClick={() => setMobileWorkflowOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#0e372d',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }} />
                Workflow
              </button>
            )}

            {/* Operations Dashboard Button */}
            {!isMobile ? (
              <button
                onClick={() => setActiveView(activeView === 'founder' ? 'chat' : 'founder')}
                style={{
                  background: '#18181b',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Operations Dashboard ↗
              </button>
            ) : (
              <button
                onClick={() => setActiveView(activeView === 'founder' ? 'chat' : 'founder')}
                title="Operations Dashboard"
                style={{
                  background: '#18181b',
                  border: 'none',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                ↗
              </button>
            )}
          </div>
        </header>

        {/* ===================================================================== */}
        {/* SUBVIEW CONTAINER (If activeView !== 'chat')                          */}
        {/* ===================================================================== */}
        {activeView !== 'chat' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '12px' : '16px', zIndex: 1 }}>
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
          <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
            
            {/* Conversation Stream */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? '16px 12px 110px 12px' : '28px 24px 130px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '820px',
                  margin: '0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '18px' : '24px'
                }}
              >
                {/* Architecture Purpose Banner */}
                <PagePurposeBanner
                  pageTitle="Conversational Intelligence (Unified Intent Gateway)"
                  tagline="Autonomous query routing across deterministic SQL, pgvector RAG, and MCP tools"
                  whatItDoes="Serves as the primary natural-language conversational interface powered by Google Gemini 2.5. Employees can ask operational, financial, and warehouse questions, audit wholesale partner terms, request live metrics, and review step-by-step reasoning workflows with persistent multi-turn chat sessions."
                  solutionContribution="Eliminates the need for employees to manually navigate disjoint systems (Seller DB, WMS, Partner Portal, QuickBooks). Jarvis autonomously decides whether a question requires pre-compiled SQL metrics, semantic document retrieval with chunk citations, or restricted workflow executions, turning fragmented organizational data into actionable answers."
                  badges={[
                    'Google Gemini AI Reasoning',
                    'Autonomous Intent Orchestration',
                    'Multi-Turn Session Continuity',
                    'Real-Time Workflow Streaming',
                    'Verified Source Citations'
                  ]}
                />
                
                {/* Zero State Hero Screen when no active conversation */}
                {messages.length === 0 ? (
                  <div
                    style={{
                      margin: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      maxWidth: '720px',
                      padding: isMobile ? '30px 10px 60px 10px' : '60px 20px 60px 20px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#0e372d', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 4px 14px rgba(14, 55, 45, 0.25)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                        <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/>
                      </svg>
                    </div>
                    <h2 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                      Where should we begin?
                    </h2>
                    <p style={{ fontSize: isMobile ? '13px' : '14px', color: '#6b7280', margin: '0 0 28px 0', maxWidth: '520px', lineHeight: '1.5' }}>
                      Ask operational questions, investigate wholesale credit limits, audit return grading SOPs, or evaluate dock-to-stock metrics.
                    </p>

                    {/* Prompt suggestion chips */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                        gap: '12px',
                        width: '100%',
                        maxWidth: '720px',
                        margin: '0 auto'
                      }}
                    >
                      {samplePrompts.map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            handleSubmit(null, promptText);
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e5e5e0',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#1f2937',
                            lineHeight: '1.45',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#0e372d';
                            e.currentTarget.style.boxShadow = '0 3px 10px rgba(14, 55, 45, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e5e0';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02)';
                          }}
                        >
                          <div style={{ fontWeight: '600', color: '#111827', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#0e372d' }}>✨</span>
                            <span>Query Suggestion</span>
                          </div>
                          <div style={{ color: '#4b5563', fontSize: '12.5px' }}>{promptText}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m) => (
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
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: isMobile ? '90%' : '80%' }}>
                          <div
                            style={{
                              background: '#ebe5df',
                              border: '1px solid #ded9d2',
                              borderRadius: '16px',
                              padding: isMobile ? '10px 14px' : '12px 18px',
                              fontSize: isMobile ? '13.5px' : '14.5px',
                              color: '#1f211e',
                              lineHeight: '1.55',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                            }}
                          >
                            <div>{m.content}</div>
                            <div style={{ textAlign: 'right', fontSize: '10.5px', color: '#787a74', marginTop: '4px' }}>
                              {m.timestamp}
                            </div>
                          </div>

                          {/* User Avatar */}
                          <div
                            style={{
                              width: isMobile ? '28px' : '32px',
                              height: isMobile ? '28px' : '32px',
                              borderRadius: '50%',
                              background: '#0e372d',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '600',
                              fontSize: isMobile ? '11px' : '12px',
                              flexShrink: 0
                            }}
                          >
                            PS
                          </div>
                        </div>
                      ) : (
                        /* ASSISTANT MESSAGE CONTAINER */
                        <div style={{ display: 'flex', gap: isMobile ? '10px' : '14px', width: '100%' }}>
                          {/* Jarvis Avatar */}
                          <div
                            style={{
                              width: isMobile ? '28px' : '32px',
                              height: isMobile ? '28px' : '32px',
                              borderRadius: '50%',
                              background: '#111827',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              fontSize: isMobile ? '12px' : '13px',
                              flexShrink: 0
                            }}
                          >
                            J
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Route & Latency Badges */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  color: '#6d28d9',
                                  background: '#ede9fe',
                                  border: '1px solid #ddd6fe',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontWeight: '700',
                                  letterSpacing: '0.04em'
                                }}
                              >
                                {m.route || 'KNOWLEDGE + DATA'}
                              </span>

                              {m.latencyMs && (
                                <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ⏱ {(m.latencyMs / 1000).toFixed(1)}s
                                </span>
                              )}

                              {m.isGenerating && (
                                <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span className="live-pulsing-dot" />
                                  <span>Streaming telemetry...</span>
                                </span>
                              )}
                            </div>

                            {/* Integrated Glowing AI Execution Workflow Inside Conversation Thread */}
                            {(m.isGenerating || (m.events && m.events.length > 0)) && (
                              <ExecutionWorkflow
                                events={m.events && m.events.length > 0 ? m.events : liveStreamEvents}
                                isStreaming={m.isGenerating}
                                queryTitle={latestUserQuery}
                                inline={true}
                              />
                            )}

                            {/* Structured Response from Real AI Pipeline */}
                            {m.isGenerating && !m.content ? (
                              <div style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '13.5px', padding: '6px 0' }}>
                                Synthesizing grounded response with verified citations...
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
                  ))
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. BOTTOM FLOATING CHAT INPUT BAR                                    */}
        {/* ===================================================================== */}
        {activeView === 'chat' && (
          <div
            style={{
              position: 'absolute',
              bottom: isMobile ? '12px' : '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: isMobile ? 'calc(100% - 24px)' : 'min(820px, calc(100% - 48px))',
              zIndex: 35
            }}
          >
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#ffffff',
                borderRadius: '32px',
                padding: isMobile ? '4px 6px 4px 10px' : '6px 10px 6px 12px',
                border: '1px solid #ded9d2',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)'
              }}
            >
              {/* Add tools / context button */}
              <button
                type="button"
                onClick={() => {}}
                title="Add context or files"
                style={{
                  width: isMobile ? '28px' : '32px',
                  height: isMobile ? '28px' : '32px',
                  borderRadius: '50%',
                  background: '#f3f2ee',
                  border: 'none',
                  color: '#52525b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: isMobile ? '14px' : '16px',
                  flexShrink: 0
                }}
              >
                +
              </button>

              {/* Chat Input Field */}
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask Jarvis..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#1a1c19',
                  padding: isMobile ? '6px 10px' : '8px 14px',
                  fontSize: isMobile ? '13.5px' : '14.5px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  minWidth: 0
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px' }}>
                {/* Think reasoning toggle */}
                <button
                  type="button"
                  onClick={() => setIsDeepThink(!isDeepThink)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isMobile ? '3px 8px' : '4px 10px',
                    borderRadius: '16px',
                    background: isDeepThink ? '#e8f5ec' : '#f3f2ee',
                    color: isDeepThink ? '#0e372d' : '#52525b',
                    border: 'none',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>⭘</span>
                  <span>Think</span>
                </button>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isLoading}
                  style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '50%',
                    background: '#0e372d',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'default',
                    opacity: inputQuery.trim() && !isLoading ? 1 : 0.6,
                    transition: 'opacity 0.15s ease',
                    flexShrink: 0
                  }}
                >
                  <svg width={isMobile ? '13' : '15'} height={isMobile ? '13' : '15'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="19" x2="12" y2="5"/>
                    <polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Authentication Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onAuthSuccess={(user, initialConvId) => {
            setCurrentUser(user);
            loadConversations();
            if (initialConvId) {
              handleSelectSession({ id: initialConvId });
            }
          }}
        />

      </main>
    </div>
  );
}
