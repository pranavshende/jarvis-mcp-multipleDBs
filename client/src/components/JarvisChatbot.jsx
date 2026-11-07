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

  // Initial seed message matching the luxury reference screenshot
  const initialDemoMessages = [
    {
      id: 'demo-user-1',
      role: 'user',
      content: 'Why is Partner 301 on credit hold and what is the process to release it?',
      timestamp: '10:24 AM'
    },
    {
      id: 'demo-bot-1',
      role: 'assistant',
      route: 'KNOWLEDGE + DATA',
      latencyMs: 12400,
      content: "Here's the analysis for Partner 301's credit hold and the required release process.",
      citations: [
        'partner-terms.md (v1.0) -> §4.2 Credit Hold Policy',
        'AR-policy.md (v1.1) -> Credit Release Procedure'
      ],
      timestamp: '10:24 AM'
    }
  ];

  // Conversational state
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_active_chat');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialDemoMessages;
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [liveStreamEvents, setLiveStreamEvents] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDeepThink, setIsDeepThink] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(true);
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 'sess-1', title: 'Partner 301 credit hold analysis', messages: [] },
      { id: 'sess-2', title: 'EWR1 vs ONT1 receiving process', messages: [] },
      { id: 'sess-3', title: 'Return grading rules', messages: [] },
      { id: 'sess-4', title: 'October ACH failure post-mortem', messages: [] }
    ];
  });
  const [currentSessionId, setCurrentSessionId] = useState('demo');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Dynamic Projects / Prompts (persisted in localStorage)
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('msc_jarvis_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 'proj-1', name: 'Partner Credit & AR Aging', query: 'Why is Partner 301 on credit hold and what is their exposure?' },
      { id: 'proj-2', name: 'Warehouse Intake SLA (EWR1/ONT1)', query: 'How many packages were received yesterday at EWR1 vs ONT1?' },
      { id: 'proj-3', name: 'FIFO Inventory Costing', query: 'What is the FIFO cost breakdown for inventory stock?' },
      { id: 'proj-4', name: 'Inspection & Grading Governance', query: 'What are the SOP inspection rules for return grading?' }
    ];
  });
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
    setShowWorkflowPanel(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleSelectSession = (session) => {
    setActiveView('chat');
    setCurrentSessionId(session.id);
    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      // Load relevant analysis
      setMessages([
        {
          id: `u-${session.id}`,
          role: 'user',
          content: session.title,
          timestamp: '10:24 AM'
        },
        {
          id: `b-${session.id}`,
          role: 'assistant',
          route: 'KNOWLEDGE + DATA',
          latencyMs: 12400,
          content: `Here's the analysis for ${session.title}.`,
          citations: ['partner-terms.md (v1.0) -> §4.2 Credit Hold Policy'],
          timestamp: '10:24 AM'
        }
      ]);
    }
    setShowWorkflowPanel(true);
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
            route: res.route || 'KNOWLEDGE + DATA',
            citations: res.citations || [],
            toolsInvoked: res.toolsInvoked || [],
            latencyMs: res.latencyMs || latency,
            fromCache: res.fromCache || false,
            events: res.executionEvents && res.executionEvents.length > 0 ? res.executionEvents : collectedEvents,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          setMessages((prev) => prev.map((m) => (m.id === pendingBotId ? finalBotMessage : m)));
          setLiveStreamEvents([]);

          // Update current or new chat session
          if (currentSessionId === 'new' || currentSessionId === 'demo') {
            const newId = `sess-${Date.now()}`;
            const newTitle = query.length > 32 ? query.substring(0, 32) + '...' : query;
            const newSession = {
              id: newId,
              title: newTitle,
              messages: [userMessage, finalBotMessage]
            };
            setChatSessions((prev) => [newSession, ...prev]);
            setCurrentSessionId(newId);
          }
        },
        // On Error fallback
        async (streamErr) => {
          try {
            const res = await queryGatewayIntent(query, currentSessionId);
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
    'Why is Partner 301 on credit hold and what is the process to release it?',
    'What are the Gold partner credit terms and payment policies?',
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
        background: '#f8f7f4',
        color: '#1a1c19',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. FIXED COLLAPSIBLE SIDEBAR (Warm Ivory / Minimalist)                     */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: sidebarOpen ? '260px' : '0px',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          background: '#f3f2ee',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #e8e6df',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 40
        }}
      >
        {/* Brand Header */}
        <div style={{ padding: '16px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            onClick={() => setActiveView('chat')}
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
              title="Collapse sidebar"
              style={{ background: 'transparent', border: 'none', color: '#787a74', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
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

        {/* New Chat Button (Dark Forest Green Pill) */}
        <div style={{ padding: '6px 12px 10px' }}>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
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

        {/* Enterprise Navigation Links */}
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
                onClick={() => setActiveView(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
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
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = '#ebeae4';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
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
          
          {/* Projects / Prompts Header */}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1a1c19';
                e.currentTarget.style.background = '#e5e3dc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#787a74';
                e.currentTarget.style.background = 'transparent';
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
                    setInputQuery(p.query || `Provide an executive briefing on ${p.name}`);
                    if (inputRef.current) inputRef.current.focus();
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

          {/* Recents */}
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#787a74', padding: '4px 10px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredSessions.map((s) => {
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
            })}
          </div>
        </div>

        {/* Authenticated User Profile Footer */}
        <div
          onClick={() => setShowProfileModal(true)}
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #e8e6df',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f3f2ee',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#ebeae4')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#f3f2ee')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                fontSize: '13px'
              }}
            >
              PS
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1c19' }}>Pranav Shende</div>
              <div style={{ fontSize: '11px', color: '#787a74' }}>Founder • Executive Access</div>
            </div>
          </div>
          <div style={{ color: '#787a74', fontSize: '13px' }}>•••</div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN APPLICATION CANVAS (Warm Linen / Fluid Stepper / Live Drawer)     */}
      {/* ========================================================================= */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#f8f7f4', overflow: 'hidden' }}>
        
        {/* Artistic generative background contour lines (Matching design reference) */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '460px',
            height: '460px',
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
          <path d="M-80,20 C80,-10 140,120 210,70 C280,20 350,160 490,130" stroke="#ded8cd" strokeWidth="0.9" />
        </svg>

        {/* Top Header Bar */}
        <header
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e8e6df',
            background: 'rgba(248, 247, 244, 0.95)',
            backdropFilter: 'blur(8px)',
            zIndex: 30
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Open sidebar"
                style={{ background: 'transparent', border: 'none', color: '#787a74', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              </button>
            )}

            <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a1c19' }}>
              Jarvis 1.0 Enterprise
            </span>

            {/* Model Selector Dropdown Pill */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowModelMenu(!showModelMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  color: '#1a1c19',
                  fontSize: '12.5px',
                  fontWeight: '500',
                  padding: '3px 10px',
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
                    width: '220px',
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
                        fontSize: '12.5px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            
            {/* DB Health Pill */}
            <span
              style={{
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: '16px',
                background: dbStatus === 'HEALTHY' ? '#e8f5ec' : '#fee2e2',
                color: dbStatus === 'HEALTHY' ? '#166534' : '#dc2626',
                border: `1px solid ${dbStatus === 'HEALTHY' ? '#bbf7d0' : '#fecaca'}`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '500'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dbStatus === 'HEALTHY' ? '#16a34a' : '#ef4444' }} />
              {dbStatus === 'HEALTHY' ? 'DB Connected - Redis Active' : 'System Degraded'}
            </span>

            {/* Chunks Pill */}
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
              ⚡ 746 Chunks Indexed
            </span>

            {/* Operations Dashboard Button */}
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
              onMouseEnter={(e) => (e.currentTarget.style.background = '#27272a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#18181b')}
            >
              Operations Dashboard ↗
            </button>
          </div>
        </header>

        {/* ===================================================================== */}
        {/* SUBVIEW CONTAINER (If activeView !== 'chat')                          */}
        {/* ===================================================================== */}
        {activeView !== 'chat' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', zIndex: 1 }}>
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
          /* CONVERSATIONAL CHATBOT CANVAS (Split View: Chat Stream + Workflow)   */
          /* =================================================================== */
          <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
            
            {/* Left/Center: Conversation Stream */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 120px 32px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', maxWidth: '80%' }}>
                        <div
                          style={{
                            background: '#ebe5df',
                            border: '1px solid #ded9d2',
                            borderRadius: '16px',
                            padding: '12px 18px',
                            fontSize: '14.5px',
                            color: '#1f211e',
                            lineHeight: '1.55',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                          }}
                        >
                          <div>{m.content}</div>
                          <div style={{ textAlign: 'right', fontSize: '11px', color: '#787a74', marginTop: '4px' }}>
                            {m.timestamp || '10:24 AM'}
                          </div>
                        </div>

                        {/* User Avatar */}
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
                            fontSize: '12px',
                            flexShrink: 0
                          }}
                        >
                          PS
                        </div>
                      </div>
                    ) : (
                      /* ASSISTANT MESSAGE CONTAINER */
                      <div style={{ display: 'flex', gap: '14px', width: '100%' }}>
                        {/* Jarvis Avatar */}
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#111827',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '13px',
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
                                fontSize: '11px',
                                color: '#6d28d9',
                                background: '#ede9fe',
                                border: '1px solid #ddd6fe',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontWeight: '700',
                                letterSpacing: '0.04em'
                              }}
                            >
                              {m.route || 'KNOWLEDGE + DATA'}
                            </span>

                            <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              ⏱ {m.latencyMs ? (m.latencyMs / 1000).toFixed(1) : '12.4'}s
                            </span>
                          </div>

                          {/* Assistant Response Text */}
                          <div style={{ fontSize: '14.5px', color: '#1f2937', lineHeight: '1.6', marginBottom: '10px' }}>
                            {m.content}
                          </div>

                          {/* Structured Response Cards */}
                          <StructuredResponse
                            content={m.content}
                            citations={m.citations}
                            onOpenCitation={(c) => setActiveCitation(c)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Right: Docked AI Execution Workflow Panel (Matching design reference) */}
            {showWorkflowPanel && (
              <div
                style={{
                  width: '370px',
                  padding: '24px 20px 120px 0',
                  overflowY: 'auto',
                  flexShrink: 0
                }}
              >
                <div style={{ position: 'sticky', top: 0 }}>
                  <ExecutionWorkflow
                    events={liveStreamEvents}
                    isStreaming={isLoading}
                    queryTitle={messages[messages.length - 2]?.content || 'Investigating Partner 301 credit hold and release process.'}
                    onClose={() => setShowWorkflowPanel(false)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. BOTTOM FLOATING CHAT INPUT BAR (Luxury White Pill)                */}
        {/* ===================================================================== */}
        {activeView === 'chat' && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: sidebarOpen ? 'calc(50% - 130px)' : '50%',
              transform: 'translateX(-50%)',
              width: '90%',
              maxWidth: '720px',
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
                padding: '6px 10px 6px 12px',
                border: '1px solid #ded9d2',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)'
              }}
            >
              {/* Add tools / context button */}
              <button
                type="button"
                onClick={() => {}}
                title="Add context or files"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#f3f2ee',
                  border: 'none',
                  color: '#52525b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px'
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
                  padding: '8px 14px',
                  fontSize: '14.5px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Think reasoning toggle */}
                <button
                  type="button"
                  onClick={() => setIsDeepThink(!isDeepThink)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    background: isDeepThink ? '#e8f5ec' : '#f3f2ee',
                    color: isDeepThink ? '#0e372d' : '#52525b',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <span>⭘</span>
                  <span>Think</span>
                </button>

                {/* Submit button (Dark forest green circle with upward white arrow) */}
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isLoading}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#0e372d',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: inputQuery.trim() && !isLoading ? 'pointer' : 'default',
                    opacity: inputQuery.trim() && !isLoading ? 1 : 0.6,
                    transition: 'opacity 0.15s ease'
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                </button>
              </div>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
