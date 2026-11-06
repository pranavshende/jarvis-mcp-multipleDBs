# Jarvis v1: Technical System Architecture (Enterprise Edition)
**Unified Intelligence Platform for Meridian Supply Chain (MSC)**
*Author: Principal Software Architect, Senior AI Engineer & Technical Documentation Specialist*
*Target Infrastructure: Modest Linux EU Application Host (Hetzner Cloud fsn1) + Supabase Managed PostgreSQL 16 (EU Central / Frankfurt)*
*Source Systems: AWS RDS us-east-1 (PostgreSQL: seller_db, wms_db, portal_db), QuickBooks Online, Team AI Workspaces, Slack*
*Date: October 2026*
*Document Status: Certified & Hardened Architectural Blueprint*

---

## 1. Fundamental Architectural Principle

> **Jarvis is an intelligence layer over Meridian's existing business systems, not a replacement ERP or business management system.**

Meridian Supply Chain (MSC) operates three core transactional systems:
1. `seller_db` (Django / PostgreSQL): Transactional platform for 6,000 independent sellers, buy lists, and cashout disbursements.
2. `wms_db` (Ruby on Rails / PostgreSQL): Operational warehouse management system across East (EWR1) and West (ONT1) fulfillment hubs.
3. `portal_db` (Next.js / PostgreSQL): Wholesale buyer portal for 400 B2B partners, dynamic quoting, orders, and public market index.

Jarvis does **not** replace the Django seller platform, Rails WMS, or Next.js portal. It neither writes primary financial ledger entries nor directly modifies operational warehouse bin allocations. Instead, Jarvis serves as an **authoritative, read-only intelligence layer with a human-confirmed action boundary** that:
- Unifies disparate operational data across unshared keys into a canonical crosswalk.
- Enforces certified mathematical metrics for corporate KPIs via a pre-compiled Metrics Registry.
- Dispatches proactive alerts before operational or credit crises escalate.
- Provides semantic context and institutional memory to 25 teammates across all AI interfaces.
- Triggers approved operational workflows strictly via a **Restricted Action Service** requiring human confirmation.

### Core Architectural Invariants
1. **Numbers from SQL, Context from Documents**: Business numbers (revenue, margins, package counts, credit balances) come exclusively from live systems via pre-compiled SQL in a curated Metrics Registry against the Supabase Analytics Schema. Vector memory stores zero numbers.
2. **Zero Direct Database Write Access for LLMs**: The AI model possesses no database write privileges whatsoever. Any operational action (e.g., placing a credit hold on Northgate) must traverse the **Restricted Action Service** with human approval, scoped API credentials, and unique idempotency keys.
3. **Identity Propagation & Per-User Scoping**: Every incoming query is bound to an authenticated Meridian employee email (`firstname@meridiansc.com`). Multi-layered authorization (Gateway RBAC, Tool Scopes, Supabase Database Roles, and Row-Level Security) prevents horizontal or vertical data leakage.
4. **Physically Isolated Sensitive Data**: Full bank account numbers, member payment credentials, and raw employee payroll tables are excluded from replication to the analytics host.
5. **Modern MCP Protocol Standards**: Uses official Model Context Protocol (MCP) transports: `stdio` for local tools and **Streamable HTTP** for remote clients, eliminating deprecated HTTP+SSE transports.

---

## 2. Information Trajectory: The End-to-End Request Journey

Information flows through a single, strictly governed path:

```
Employee (Slack / MCP Client / Admin Panel)
   │
   ▼
[1. User Interaction Layer]
   │  (Transports: Slack Socket Mode / MCP stdio / Streamable HTTP with Bearer Auth)
   ▼
[2. Gateway Layer: Fastify Orchestrator]
   │  (Identity Resolution, Role Binding, Input Sanitization, Rate Limiting, Audit Logging)
   ▼
[3. Intent Router & Tool Selector]
   │  (Classifies Query: Metric, Document Knowledge, Proactive Alert, Action, or Dual Synthesis)
   ├────────────────────────┬────────────────────────┬────────────────────────┐
   ▼                        ▼                        ▼                        ▼
[4. Metrics Engine] [5. Alert Engine]       [6. Memory & Retrieval]  [7. Restricted Action Service]
   │ (Pre-compiled SQL)    │ (Deterministic Rules)  │ (Dense + Sparse RRF)   │ (Human Confirmation Required)
   ▼                        ▼                        ▼                        ▼
[Analytics Schema]   [Rules Evaluator]       [pgvector Memory]        [Restricted Business API]
   │ (Supabase EU)          │ (Pre-computed triggers)│ (Supabase EU)          │ (Idempotency Key & Scopes)
   ▲                        │                        ▲                        ▼
   │ Sources: seller_db,    │                        │ Sources: Notes, Drive, [Downstream System]
   │ wms_db, portal_db, QBO │                        │ Session Candidates     │ (e.g. Portal Credit Hold)
   └────────────────────────┴────────────────────────┴────────────────────────┘
                                   │
                                   ▼
                    [8. Configurable Model Router]
                       (Claude 3.5 Sonnet / Haiku / GPT-4o-mini via models_registry.yaml)
                       (Token spend caps, composite authorization-aware caching)
                                   │
                                   ▼
                    [9. Structured Response with Evidence]
                       (Exact numbers from SQL + Markdown citations + Action confirmation)
```

---

## 3. The 12 Architectural Layers

### Layer 1: User Interaction Layer
Provides client connectivity across all existing employee tools:
- **Slack Bot (`@jarvis`)**: Primary conversational interface in company channels and private DMs, operating via Slack Socket Mode (avoiding inbound public webhook exposure).
- **Model Context Protocol (MCP) Clients**: Official MCP connectors for Claude Desktop, Claude Code, Cursor IDE, Codex, and Gemini CLI. Uses `stdio` for local environments and **Streamable HTTP** for remote connections.
- **Jarvis Admin Dashboard**: Web management portal for team leads and administrators to manage users, tokens, AI spend, memory candidate approvals, and system health.

### Layer 2: MCP and API Gateway
Single network edge running as a Node.js/Fastify service on the Hetzner EU host:
- Supports `stdio` transport and **Streamable HTTP** (`/mcp/stream`) with HTTP Bearer authentication.
- Enforces IP and token-based rate limiting (120 requests/minute per token; burst up to 30).
- Validates all inbound payloads using strongly-typed Zod schemas.

### Layer 3: Authentication and Authorization Layer
- Resolves client-specific identity tokens to Meridian corporate email (`firstname@meridiansc.com`).
- Enforces Role-Based Access Control (RBAC) across 8 discrete roles (Founder, Ops, Finance, Sales, Warehouse, Support, Engineering, Admin).
- Injects an immutable `UserSecurityContext` into downstream tool executions.

### Layer 4: AI Orchestration and Intent Router
- Single orchestrator architecture utilizing LLM function calling (OpenAI / Anthropic tool use specification).
- Employs zero-shot prompt routing to classify user queries into five execution branches:
  1. `Metric Query`: Invokes `execute_metric()` from the registry.
  2. `Document Query`: Invokes `search_company_knowledge()` over pgvector memory.
  3. `Alert / Incident Query`: Invokes `get_active_alerts()`.
  4. `Action Request`: Invokes `request_action_execution()` (requires human confirmation).
  5. `Dual Synthesis`: Queries metrics first, enriches with document citations.

### Layer 5: Business Metrics Engine
- Central repository of pre-compiled, parameterized SQL queries (`metrics_registry.yaml`).
- Enforces dynamic IANA timezone casting (`America/New_York` for East, `America/Los_Angeles` for West) directly in PostgreSQL via `AT TIME ZONE`.
- Governs data freshness watermarks (`data_as_of: 2026-10-20T13:30:00Z`).

### Layer 6: Proactive Alert Engine & Notification Adapters
- Background daemon powered by BullMQ on Redis 7.
- Executes deterministic threshold monitors:
  - *ACH Payout Failures*: Detects `status = 'failed'` or `on_hold > 24h`.
  - *Partner Credit Breaches*: Detects `open_ar > credit_limit`.
  - *Inventory Cost Inversions*: Detects `market_spot_price < fifo_unit_cost`.
- Employs a decoupled **Notification Adapter** routing structured alert events to Slack Block Kit, Admin Panel, or email.

### Layer 7: Shared Company Memory and RAG
- Hosted on Supabase utilizing the native `pgvector` extension.
- Employs Hybrid Retrieval combining dense vector embeddings (1536-dim via `text-embedding-3-small`) with sparse keyword matching (`tsvector` with BM25-equivalent ranking) merged via Reciprocal Rank Fusion (RRF).
- Enforces cross-encoder reranking to deliver the top-5 most relevant chunks with file and line-level citations.

### Layer 8: Unified Analytics Database (Supabase EU Central)
- High-performance Managed PostgreSQL 16 database hosted on **Supabase** in AWS EU Central (Frankfurt).
- Star schema containing unified dimensions (`dim_members`, `dim_partners`, `dim_products`, `dim_warehouses`, `dim_product_crosswalk`) and fact tables (`fact_dock_receipts`, `fact_orders`, `fact_invoices`, `fact_payouts`, `fact_cost_layers`).
- Structurally excludes sensitive columns (bank accounts, routing numbers, raw salaries).

### Layer 9: PostgreSQL + pgvector Memory Store (Supabase)
- Partitioned vector tables separating public company documentation (`knowledge_public`), department-scoped procedures (`knowledge_dept`), and user-private session notes (`knowledge_private`).
- Enforces knowledge staging: AI session extracts are staged as candidates and require human owner approval or multi-session corroboration before promotion to global memory.

### Layer 10: Canonical Product Crosswalk & Identity Resolution
- Canonical product crosswalk reconciling WMS items, Portal products, UPC barcodes, and manufacturer codes with explicit mapping sources and confidence scores.
- Member and partner resolution requiring exact verified identifiers or multi-attribute matching (confidence >= 0.95), strictly avoiding naive domain-based merging.

### Layer 11: Primary Data Synchronization Layer
- Scheduled CDC / incremental extraction worker querying AWS RDS read replicas over a secure connection.
- 15-minute incremental sync frequency using `updated_at` checkpoints and retry queues; nightly full reconciliation detecting deletions and layer adjustments.
- Treats the three source databases as physically separate systems consolidated only within the Supabase analytics schema.

### Layer 12: Restricted Action Service
- Strictly isolated service layer managing authorized business workflows.
- Operates with dedicated, narrowly scoped API credentials to downstream business systems.
- Mandates explicit human confirmation, generates unique idempotency keys, and writes immutable audit ledger records.

---

## 4. The 12 Comprehensive Architectural Diagrams (Mermaid)

### Diagram 1: High-Level System Architecture
```mermaid
flowchart TD
    subgraph Clients["User Interaction Layer"]
        Slack["Slack App (Socket Mode)"]
        LocalMCP["Claude Desktop / Cursor (stdio)"]
        RemoteMCP["Remote MCP Clients (Streamable HTTP)"]
        AdminUI["Jarvis Admin Dashboard (Web)"]
    end

    subgraph Gateway_Boundary["Jarvis Gateway & Orchestration (Hetzner fsn1)"]
        Gateway["Fastify Gateway (MCP & Slack Server)"]
        Auth["Identity Resolver & RBAC Policy"]
        Router["Intent Router (Tool Selection)"]
        ModelGate["Configurable Model Router (models_registry.yaml)"]
        ActionSvc["Restricted Action Service (Human-Confirmed)"]
    end

    subgraph Engines["Execution Engines"]
        Metrics["Metrics Engine (Deterministic SQL)"]
        Alerts["Alert Engine (Rules + Anomaly)"]
        RAG["Memory Engine (Hybrid Search + Citations)"]
    end

    subgraph Storage["Data Tier (Supabase PostgreSQL 16 - EU Central)"]
        AnalyticsDB[("Unified Analytics Schema
(Read Replica Consolidated Copy)")]
        VectorStore[("Memory Store (pgvector)
(Notes, SOPs, Candidates)")]
    end

    subgraph Sources["Meridian Source Systems (AWS / SaaS)"]
        SellerDB[("seller_db (Django)")]
        WMSDB[("wms_db (Rails)")]
        PortalDB[("portal_db (Next.js)")]
        QBO["QuickBooks Online"]
        NotesDrive["Company Notes & Session Logs"]
    end

    Clients --> Gateway
    Gateway --> Auth --> Router
    Router <--> ModelGate
    Router --> Metrics
    Router --> Alerts
    Router --> RAG
    Router --> ActionSvc

    Metrics --> AnalyticsDB
    Alerts --> AnalyticsDB
    RAG --> VectorStore
    ActionSvc -.->|Idempotent API Call| PortalDB

    SellerDB -.->|15m Sync| AnalyticsDB
    WMSDB -.->|15m Sync| AnalyticsDB
    PortalDB -.->|15m Sync| AnalyticsDB
    QBO -.->|Nightly ETL| AnalyticsDB
    NotesDrive -.->|Sanitized Ingestion| VectorStore
```

---

### Diagram 2: Detailed Component Architecture
```mermaid
flowchart LR
    subgraph Edge["Network Edge"]
        Nginx["Nginx Reverse Proxy
(TLS 1.3 / Rate Limiting)"]
    end

    subgraph Core_Service["Jarvis Core Application (Node.js/TypeScript)"]
        FastifyApp["Fastify HTTP Server"]
        MCPHandler["Official MCP SDK
(stdio + Streamable HTTP)"]
        SlackBolt["Slack Bolt Engine (Socket Mode)"]
        AdminAPI["Admin Dashboard API Engine"]
        
        AuthModule["Auth & RBAC Validator"]
        AuditLogger["Audit & Compliance Logger"]
        InputSanitizer["Prompt Guard & Delimiter Scanner"]
        
        Orchestrator["Single Orchestrator Router"]
        MetricsEngine["SQL Metrics Compiler"]
        RAGService["Hybrid Retrieval Service"]
        AlertService["Proactive Alert Daemon"]
        ActionService["Restricted Action Service"]
    end

    subgraph Workers["Background Workers (BullMQ on Redis 7)"]
        ETLWorker["15m Incremental Sync Client"]
        AlertWorker["Scheduled Rule Monitor"]
        DLQWorker["Dead-Letter Queue Handler"]
    end

    subgraph Data_Services["Persistence Tier"]
        SupabaseDB[("Supabase Managed PostgreSQL 16
- Supavisor Pooler (6543/5432)
- analytics schema
- jarvis_memory (pgvector)
- jarvis_system")]
        RedisCache[("Redis 7 Instance
- BullMQ queues & DLQ
- Composite Semantic Cache")]
    end

    Nginx --> FastifyApp
    FastifyApp --> MCPHandler
    FastifyApp --> SlackBolt
    FastifyApp --> AdminAPI
    MCPHandler --> AuthModule
    SlackBolt --> AuthModule
    AdminAPI --> AuthModule
    AuthModule --> AuditLogger --> InputSanitizer --> Orchestrator

    Orchestrator --> MetricsEngine
    Orchestrator --> RAGService
    Orchestrator --> AlertService
    Orchestrator --> ActionService

    MetricsEngine --> SupabaseDB
    RAGService --> SupabaseDB
    AlertService --> SupabaseDB
    ActionService --> SupabaseDB

    ETLWorker --> SupabaseDB
    AlertWorker --> SupabaseDB
    DLQWorker --> RedisCache

    ETLWorker <--> RedisCache
    AlertWorker <--> RedisCache
```

---

### Diagram 3: End-to-End Request Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor User as Employee (Sofia Lindqvist)
    participant Client as Remote MCP Client (Streamable HTTP)
    participant Edge as Nginx Edge
    participant GW as Jarvis Gateway
    participant Auth as RBAC & Auth Engine
    participant Router as Intent Router
    participant Metrics as Metrics Engine
    participant DB as Supabase Analytics DB
    participant LLM as Claude 3.5 Sonnet
    participant Audit as Audit Log

    User->>Client: "What is Northgate's current past-due balance?"
    Client->>Edge: POST /mcp/stream (Bearer token: msc_mcp_sofia_xxx)
    Edge->>GW: Forward Streamable HTTP Request
    GW->>Auth: Authenticate Token & Resolve User
    Auth-->>GW: UserSecurityContext: { email: "sofia@meridiansc.com", role: "ROLE_SALES" }
    GW->>Audit: Log Inbound Request
    GW->>Router: Analyze Intent & Select Tools
    Router->>LLM: Tool Selection (Tools: [execute_metric, search_company_knowledge])
    LLM-->>Router: Call execute_metric("partner_ar_balance", { partner_id: 301 })
    Router->>Metrics: Validate Permissions & Compile Pre-Approved SQL
    Metrics->>DB: SELECT open_balance, past_due_balance FROM mv_partner_ar_aging WHERE partner_id = 301
    DB-->>Metrics: Row: { open_balance: 284279.37, past_due: 185550.00, credit_limit: 250000.00 }
    Metrics-->>Router: Structured Metric Result
    Router->>LLM: Format Response with Context & Provenance
    LLM-->>Router: Factual Natural Language Response
    Router-->>GW: Payload with Provenance Metadata
    GW->>Audit: Log Completion, Tokens, and Execution Latency
    GW-->>Edge: Stream Result Chunk
    Edge-->>Client: Stream Result
    Client-->>User: Display Response with Evidence Table & Timestamps
```

---

### Diagram 4: Live Business Intelligence Pipeline
```mermaid
flowchart TD
    UserQuery["User asks business question
('How many packages received yesterday?')"] --> Router["Intent Router"]
    Router --> RegistryCheck{"Lookup in
metrics_registry.yaml"}
    
    RegistryCheck -->|Found| PrecompiledSQL["Fetch Approved SQL Template:
'daily_dock_receiving'"]
    RegistryCheck -->|Not Found| Refuse["Refuse query with explanation
(Never generate unrestricted SQL)"]
    
    PrecompiledSQL --> ParamBinding["Bind Sanitized Parameters via Zod:
{ target_date: '2026-10-19' }"]
    ParamBinding --> RoleCheck{"User Role has
permission for metric?"}
    
    RoleCheck -->|Authorized| ExecuteSQL["Execute via Read-Only Role
on Supabase Analytics Schema"]
    RoleCheck -->|Denied| AuthError["Return 403 Forbidden
(Log security exception)"]
    
    ExecuteSQL --> TimezoneEngine["Dynamic IANA Timezone Engine:
(received_at AT TIME ZONE w.timezone)::date
(EWR1: America/New_York, ONT1: America/Los_Angeles)"]
    TimezoneEngine --> FreshnessTag["Inject Freshness & Watermark:
(data_as_of: 2026-10-20T13:30:00Z)"]
    FreshnessTag --> LLM_Synthesis["LLM Words Response
(Strictly constrained to SQL output)"]
    LLM_Synthesis --> Output["Final Answer with Exact Numbers & Methodology"]
```

---

### Diagram 5: RAG Ingestion and Retrieval Pipeline
```mermaid
flowchart TD
    subgraph Ingestion_Stage["Ingestion Pipeline (Asynchronous / Nightly)"]
        RawDocs["Company Notes, SOPs, Policies
(from notes/ directory)"] --> Redactor["PII & Sensitive Redactor
(SSN, Salaries, Full Bank Accounts)"]
        Redactor --> FilterPrivate{"Belongs to
founder_private?"}
        FilterPrivate -->|Yes| Drop["Exclude from Shared Index"]
        FilterPrivate -->|No| Chunker["Semantic Markdown Chunker
(512 tokens + 10% overlap)"]
        Chunker --> Embedder["Generate Embeddings
(text-embedding-3-small)"]
        Embedder --> VectorInsert["Insert into Supabase pgvector with HNSW index"]
        Chunker --> TextIndex["Generate tsvector for GIN Full-Text Search"]
    end

    subgraph Query_Stage["Retrieval Pipeline (Runtime <300ms)"]
        Query["User Question ('What are Gold partner terms?')"] --> EmbedQuery["Embed Query Vector"]
        Query --> TokenizeText["Parse Keyword Terms"]
        EmbedQuery --> DenseSearch["Dense Cosine Search (pgvector HNSW)"]
        TokenizeText --> SparseSearch["Sparse Full-Text Search (GIN BM25)"]
        DenseSearch --> RRF["Reciprocal Rank Fusion (RRF Scoring)"]
        SparseSearch --> RRF
        RRF --> Rerank["Cross-Encoder Top-5 Reranking"]
        Rerank --> ContextAssembly["Assemble Grounded Prompt Context
with Document Path & Section Headers"]
    end
```

---

### Diagram 6: AI Session Memory Ingestion Lifecycle
```mermaid
flowchart TD
    SessionLogs["Nightly AI Session Logs
(session_logs/ 8 teammates)"] --> PrivateStore[("Private User Workspace
(Isolated by employee email in Supabase)")]
    
    PrivateStore --> Extractor["LLM Extraction Worker
(Extract candidate facts: SOPs, terms, decisions)"]
    Extractor --> SensitiveFilter{"Contains PII, Comp,
or Bank Data?"}
    SensitiveFilter -->|Yes| Discard["Quarantine & Redact"]
    SensitiveFilter -->|No| CandidateQueue[("Candidate Knowledge Staging
(jarvis_memory.session_candidates)")]
    
    CandidateQueue --> VerificationCheck{"Verification Path"}
    VerificationCheck -->|Explicit Human Approval| OwnerApprove["Domain Owner Approves via Admin Panel
(e.g. Sofia approves Sales Term)"]
    VerificationCheck -->|Automated Corroboration| MultiSource["Corroborated across >=3 independent
team sessions with zero contradictions"]
    
    OwnerApprove --> GlobalPromotion["Promote to Global Company Memory
(Indexed in pgvector shared memory)"]
    MultiSource --> GlobalPromotion
    VerificationCheck -->|Rejected / Contradicted| Archive["Archived as Obsolete / False"]
```

---

### Diagram 7: Proactive Monitoring and Alert Pipeline
```mermaid
flowchart TD
    CronTrigger["BullMQ Scheduler on Redis 7
(5m, 15m, 1h, 24h)"] --> MetricCheck["Execute Deterministic Monitor SQL
against Supabase Analytics DB"]
    
    subgraph Rule_Evaluators["Tier 1: Deterministic Rules Engine"]
        MetricCheck --> R1{"ACH Batch Failed
or Payouts on_hold >24h?"}
        MetricCheck --> R2{"Partner AR Balance
> Approved Credit Limit?"}
        MetricCheck --> R3{"Spot Market Price
< FIFO Inventory Unit Cost?"}
        MetricCheck --> R4{"Dock Scans Variance
> 30% from 4w Average?"}
    end

    R1 -->|Triggered| AlertContext["Assemble Alert JSON Payload:
{ event: 'ACH_FAILURE', count: 77, amount: 173339.51 }"]
    R2 -->|Triggered| AlertContext
    R3 -->|Triggered| AlertContext
    R4 -->|Triggered| AlertContext

    AlertContext --> SnoozeCheck{"Alert Snoozed
or within Cooldown Window?"}
    SnoozeCheck -->|Yes| Suppress["Suppress Notification
(Log suppression in audit)"]
    SnoozeCheck -->|No| NotifAdapter["Decoupled Notification Adapter"]
    
    NotifAdapter --> SlackSink["Slack Block Kit Dispatcher
(#alerts-ops / #alerts-finance)"]
    NotifAdapter --> AdminSink["Admin Dashboard Notification Ledger"]
    NotifAdapter --> EmailSink["Urgent Executive Email (P0 Critical)"]
```

---

### Diagram 8: Canonical Crosswalk & Identity Resolution Architecture
```mermaid
flowchart TD
    subgraph Input_Records["Source Records Across Decoupled Databases"]
        S_Member["seller_db.members
(member_id: 13654, email, phone)"]
        P_Partner["portal_db.partners
(partner_id: 301, name, state)"]
        W_Item["wms_db.wms_items
(item_id: 'ITM-991', upc: '012345678901')"]
        P_Product["portal_db.catalog_products
(product_id: 'PRD-102', mfr_code: 'SD-IONST-PRK')"]
        P_Order["portal_db.orders
(order_id: 'SO-41234')"]
        W_Shipment["wms_db.outbound_shipments
(shipment_id: 'SH-881', order_ref: 'SO41234')"]
    end

    subgraph Crosswalk_Engine["Canonical Resolution Engine"]
        ProductCrosswalk["Canonical Product Crosswalk Engine:
1. Exact UPC match
2. item_map.csv manual mapping table
3. Manufacturer code crosswalk
4. Fuzzy normalized title match (Confidence >= 0.90)"]
        MemberResolver["Member & Partner Resolution Engine:
- Explicit ID mapping
- Normalized phone & email hash
- Confidence score >= 0.95 (No blind domain merges)"]
        OrderResolver["Order Reference Normalizer
(Regex string stripping: s/[^A-Za-z0-9]//g)"]
    end

    subgraph Unified_Dimensions["Unified Analytics Schema (Supabase EU)"]
        DimCrosswalk[("dim_product_crosswalk
(canonical_product_id, wms_item_id, portal_product_id,
upc, mfr_code, mapping_source, confidence_score)")]
        DimMember[("dim_members
(global_member_id, seller_id, partner_id, confidence)")]
        DimOrder[("dim_orders
(global_order_id, normalized_order_ref)")]
    end

    W_Item --> ProductCrosswalk
    P_Product --> ProductCrosswalk
    ProductCrosswalk --> DimCrosswalk

    S_Member --> MemberResolver
    P_Partner --> MemberResolver
    MemberResolver --> DimMember

    P_Order --> OrderResolver
    W_Shipment --> OrderResolver
    OrderResolver --> DimOrder
```

---

### Diagram 9: Database Entity-Relationship (ER) Architecture
```mermaid
erDiagram
    DIM_MEMBERS ||--o{ FACT_PAYOUTS : receives
    DIM_MEMBERS ||--o{ FACT_SUBMISSIONS : creates
    DIM_PARTNERS ||--o{ FACT_ORDERS : places
    DIM_PARTNERS ||--o{ FACT_INVOICES : billed
    DIM_PRODUCT_CROSSWALK ||--o{ FACT_DOCK_RECEIPTS : contains
    DIM_PRODUCT_CROSSWALK ||--o{ FACT_INSPECTIONS : evaluated
    DIM_PRODUCT_CROSSWALK ||--o{ FACT_COST_LAYERS : tracks
    DIM_WAREHOUSES ||--o{ FACT_DOCK_RECEIPTS : receives_at

    DIM_MEMBERS {
        int global_member_id PK
        int seller_member_id
        int portal_partner_id
        string email_hash
        string full_name
        string tier
        boolean is_active
        numeric resolution_confidence
    }

    DIM_PARTNERS {
        int partner_id PK
        string name
        string partner_type
        string payment_terms
        numeric credit_limit
        string account_manager
    }

    DIM_PRODUCT_CROSSWALK {
        int canonical_product_id PK
        string wms_item_id
        string portal_product_id
        string upc
        string mfr_code
        string brand_name
        string set_name
        string product_title
        string mapping_source
        numeric confidence_score
    }

    DIM_WAREHOUSES {
        int warehouse_id PK
        string code
        string name
        string timezone
    }

    FACT_DOCK_RECEIPTS {
        bigint receipt_id PK
        int warehouse_id FK
        int canonical_product_id FK
        timestamp scanned_at_utc
        date local_dock_date
        int qty_received
        string carrier_tracking
    }

    FACT_PAYOUTS {
        string payout_id PK
        int global_member_id FK
        string method
        numeric amount
        string status
        timestamp initiated_at
        string failure_reason
    }

    FACT_INVOICES {
        string invoice_id PK
        int partner_id FK
        timestamp issued_at
        date due_date
        numeric total_amount
        numeric open_balance
        int days_overdue
        string aging_bucket
    }

    FACT_COST_LAYERS {
        string lot_id PK
        int canonical_product_id FK
        date received_date
        int qty_remaining
        numeric unit_cost
        numeric extended_cost_remaining
    }
```

---

### Diagram 10: Multi-Tier Security, Authorization and Action Boundary Flow
```mermaid
flowchart TD
    ClientReq["Incoming Inbound Request
(Slack Event / Streamable HTTP)"] --> EdgeTLS["Nginx TLS 1.3 Termination & Rate Limiting"]
    
    EdgeTLS --> TokenCheck{"Valid Bearer Token
or Slack Signature?"}
    TokenCheck -->|No| Reject401["HTTP 401 Unauthorized
(Terminate connection)"]
    TokenCheck -->|Yes| ResolveUser["Resolve Corporate Identity:
Map token/SlackID to employee email"]
    
    ResolveUser --> LoadRBAC["Load Role & Scope Policy
Instantiate UserSecurityContext"]
    LoadRBAC --> ScanInjection["Prompt Guard & Delimiter Scanner
(Detect adversarial jailbreaks)"]
    
    ScanInjection --> TargetCheck{"Requested Execution Path"}
    
    TargetCheck -->|Metric Query| CheckMetricPerm{"Role has permission
for requested metric?"}
    CheckMetricPerm -->|No| Reject403["HTTP 403 Forbidden
(Log RBAC violation)"]
    CheckMetricPerm -->|Yes| ExecuteMetric["Execute Pre-Compiled SQL via Scoped DB Role
(Supabase enforces RLS and column masks)"]
    
    TargetCheck -->|Document Query| CheckRAGScope["Apply Vector Scope Filter:
WHERE scope IN ('public', user_department)"]
    CheckRAGScope --> RetrieveDocs["Retrieve Grounded Chunks from pgvector"]
    
    TargetCheck -->|Action Request| CheckActionRole{"User Role has
Action Authority?"}
    CheckActionRole -->|No| RejectAction["HTTP 403 Forbidden
(Actions restricted to Leads/Founder)"]
    CheckActionRole -->|Yes| ConfirmGate["Mandatory Human Confirmation Gate
(Interactive Button in Slack/Admin)"]
    ConfirmGate -->|User Confirms| ExecuteAction["Invoke Restricted Action Service
with Unique Idempotency Key"]
    ExecuteAction --> ActionAudit["Log to Action Audit Ledger"]
    
    ExecuteMetric --> OutputSanitizer["Output Sanitization Engine
Wrap untrusted text in <untrusted_data>"]
    RetrieveDocs --> OutputSanitizer
    OutputSanitizer --> WriteAudit["Append to Audit Log Ledger"]
    WriteAudit --> DeliverResponse["Deliver Verified Response to Client"]
```

---

### Diagram 11: Production Deployment Architecture (Modular Monolith on Hetzner + Supabase)
```mermaid
flowchart TD
    subgraph Host["Hetzner Dedicated Application Host (fsn1 - Ubuntu 24.04 LTS)"]
        UFW["Linux Kernel Firewall (UFW: 22, 80, 443 only)"]
        
        subgraph DockerNetwork["Docker Bridge Network (Internal only)"]
            Nginx["proxy: Nginx 1.25
- Ports: 80, 443
- Let's Encrypt TLS 1.3
- Rate Limit: 120r/m"]
            
            Gateway["jarvis-gateway: Node.js 20
- Streamable HTTP MCP Server
- Slack Bolt Daemon
- Admin Dashboard API
- Intent Router"]
            
            Workers["jarvis-workers: Node.js 20
- BullMQ Scheduler on Redis 7
- Proactive Alert Daemon
- 15m Incremental Sync Client
- Dead-Letter Queue (DLQ) Handler"]
            
            Redis[("jarvis-redis: Redis 7.2
- BullMQ Job Queues
- Composite Semantic Cache")]
        end

        LogicalBackupCron["Nightly Logical Backup Cron
(pg_dump export to S3)"]
    end

    subgraph Supabase_Cloud["Supabase Managed Database (EU Central - Frankfurt)"]
        Supabase_PG[("Supabase PostgreSQL 16 + pgvector
- Supavisor Connection Pooler (6543/5432)
- analytics schema
- jarvis_memory schema
- jarvis_system schema
- Automated Daily & PITR Backups")]
    end

    subgraph AWS_Cloud["AWS Infrastructure (us-east-1)"]
        RDS_Replica[("AWS RDS PostgreSQL Read Replica
(Source Databases: seller, wms, portal)")]
    end

    subgraph Offsite_Storage["Offsite Encrypted Backup Storage"]
        S3Bucket["AWS S3 / Cloudflare R2
(Encrypted Logical Dumps)"]
    end

    subgraph Observability["External Monitoring & Sinks"]
        UptimeMonitor["External Uptime Monitor (Better Uptime)"]
        SlackCloud["Slack Cloud Infrastructure"]
    end

    Nginx --> Gateway
    Gateway --> Redis
    Workers --> Redis
    Gateway -->|TLS Pooler (Port 6543)| Supabase_PG
    Workers -->|Direct TLS (Port 5432)| Supabase_PG
    Workers <-->|15m Sync Stream| RDS_Replica
    LogicalBackupCron -->|Logical Dump| Supabase_PG
    LogicalBackupCron -->|Encrypted Upload| S3Bucket
    UptimeMonitor -.->|60s HTTPS Health Ping| Nginx
    SlackCloud <-->|WSS (Socket Mode)| Gateway
```

---

### Diagram 12: Complete Corporate Data Flow Diagram
```mermaid
flowchart TD
    subgraph Sources["Operational Primary Systems"]
        S_DB["seller_db (Django)
Members, Buy Lists, Payouts"]
        W_DB["wms_db (Rails)
Dock Scans, Inspections, Stock"]
        P_DB["portal_db (Next.js)
Partners, Orders, Invoices, Market Index"]
        QBO_Export["QuickBooks Online
FIFO Cost Layers, Closed P&L, AR Aging"]
        Notes_Export["Notes & Session Logs
SOPs, Policies, AI Transcripts"]
    end

    subgraph Ingestion_Boundary["Secure Ingestion Boundary"]
        SyncEngine["15m Incremental Sync Client
(Checkpoint-based with retry queue)"]
        SanitizeETL["Sensitive Data Redactor
(Drops full bank accounts & raw payroll)"]
        DocIngest["RAG Ingestion Daemon
(Markdown parser & PII redactor)"]
    end

    subgraph Central_Storage["Central Intelligence Store (Supabase EU Central)"]
        Analytics_DB[("Analytics Schema (PostgreSQL 16)
Star Schema & Canonical Crosswalk")]
        Memory_DB[("Memory Schema (pgvector)
Document Chunks & Verified Facts")]
    end

    subgraph Application_Engines["Jarvis Application Intelligence Engines"]
        Metrics_Engine["Business Metrics Engine (Deterministic SQL)"]
        Alert_Engine["Proactive Alert Daemon (Rules + Anomaly)"]
        RAG_Engine["Hybrid Retrieval Engine (Dense + BM25)"]
        Action_Engine["Restricted Action Service (Human-Confirmed)"]
    end

    subgraph Delivery_Endpoints["Consumer & Delivery Endpoints"]
        Slack_Channels["Slack Channels (#ops, #finance, #leadership)"]
        MCP_Clients["Claude Desktop, Cursor, Gemini CLI"]
        Admin_Panel["Jarvis Admin Dashboard (Web)"]
        Downstream_APIs["Downstream Business APIs (Portal / Seller)"]
    end

    S_DB --> SyncEngine
    W_DB --> SyncEngine
    P_DB --> SyncEngine
    QBO_Export --> SyncEngine
    Notes_Export --> DocIngest

    SyncEngine --> SanitizeETL --> Analytics_DB
    DocIngest --> Memory_DB

    Analytics_DB --> Metrics_Engine
    Analytics_DB --> Alert_Engine
    Memory_DB --> RAG_Engine
    Alert_Engine --> Action_Engine

    Metrics_Engine --> MCP_Clients
    RAG_Engine --> MCP_Clients
    Alert_Engine --> Slack_Channels
    Metrics_Engine --> Admin_Panel
    Action_Engine -->|Human Confirmed| Downstream_APIs
```

---

## 5. Database Architecture & Canonical Crosswalk

### Source Database Topologies (AWS RDS us-east-1)
1. **`seller_db` (10 Tables)**: Manages 6,000 member sellers, buy lists, pre-quotes, sell submissions, payouts, and support tickets.
2. **`wms_db` (9 Tables)**: Manages fulfillment warehouses (EWR1, ONT1), package receipts, condition inspections, stock levels, and outbound shipments.
3. **`portal_db` (16 Tables)**: Manages 400 wholesale partners, catalog products, quotes, orders, invoices, payments, and market price index.

### The Canonical Product Crosswalk (`dim_product_crosswalk`)
Resolves the schema semantic mismatch between retail barcodes (`upc`) and manufacturer SKUs (`mfr_code`):
```sql
CREATE TABLE analytics.dim_product_crosswalk (
    canonical_product_id SERIAL PRIMARY KEY,
    wms_item_id TEXT UNIQUE,
    portal_product_id TEXT,
    upc VARCHAR(14),
    mfr_code TEXT,
    brand_name TEXT NOT NULL,
    set_name TEXT NOT NULL,
    product_title TEXT NOT NULL,
    mapping_source TEXT CHECK (mapping_source IN ('UPC_EXACT', 'MAPPING_FILE', 'MANUAL_VERIFIED', 'FUZZY_STRING')),
    confidence_score NUMERIC(4,3) NOT NULL,
    verified_by TEXT,
    verified_at TIMESTAMPTZ
);
```

### Dynamic IANA Timezone Normalization
Avoids brittle hardcoded EDT/PDT offsets. All SQL metric templates execute timezone conversion natively:
```sql
SELECT 
    w.code AS warehouse_code,
    (p.received_at AT TIME ZONE w.timezone)::date AS dock_local_date,
    COUNT(*) AS packages_received
FROM analytics.fact_dock_receipts p
JOIN analytics.dim_warehouses w ON p.warehouse_id = w.warehouse_id
WHERE (p.received_at AT TIME ZONE w.timezone)::date = :target_date
GROUP BY 1, 2;
```

---

## 6. AI Architecture, Routing & Modern MCP Transport

### Single Orchestrator Architecture
Jarvis v1 deliberately rejects complex multi-agent architectures (e.g., AutoGen, CrewAI) in favor of a **Single Deterministic Orchestrator**. A modular single orchestrator with strict function-calling schemas delivers sub-3-second responses at 10x lower operational cost.

### Modern MCP Protocol Standards
In compliance with the official Model Context Protocol specification:
- **`stdio`**: Transport for local desktop CLI tools (Claude Desktop local process, Cursor local extension).
- **`Streamable HTTP`**: Modern standard remote transport providing persistent streaming connections (`POST /mcp/stream`) over HTTP, replacing legacy deprecated SSE transports.

### Authorization-Aware Composite Semantic Caching
To prevent cross-user data leakage and ensure financial exactness, cache keys are computed as a multi-attribute composite hash:
```typescript
cacheKey = SHA256(
  normalizedQuery + "|" +
  JSON.stringify(sanitizedParameters) + "|" +
  userSecurityContext.role + "|" +
  userSecurityContext.allowedScopes.sort().join(",") + "|" +
  currentETLWatermarkTimestamp
);
```
- **Financial Metrics**: Require **exact parameter match** (no fuzzy semantic reuse) and short TTL (15m).
- **General SOPs**: Utilize semantic matching with high similarity threshold $\ge 0.98$.
- **Cache Invalidation**: Entire cache is purged upon completion of every 15-minute ETL synchronization.

---

## 7. Technology Selection and Justification

| Technology | Selection | Evaluated Alternatives | Architectural Rationale & Trade-off |
|---|---|---|---|
| **Core Runtime** | **Node.js 20 LTS / TypeScript** | Python (FastAPI), Go | High-throughput asynchronous I/O; official TypeScript SDKs for Model Context Protocol (MCP) and Slack Bolt; shared type definitions across gateway, workers, and tools. |
| **Relational & Vector Store** | **Supabase Managed PostgreSQL 16 + pgvector** | Self-hosted PostgreSQL on VM, Pinecone, Qdrant | Managed high-availability PostgreSQL with native `pgvector`, built-in connection pooling (Supavisor), automated point-in-time recovery (PITR), Row-Level Security (RLS), and web dashboard. Hosted in EU Central (Frankfurt) for GDPR data residency with zero server maintenance overhead. |
| **Database Access** | **Prisma / Kysely** | Raw SQL strings, TypeORM | Provides compile-time type safety, automated migrations, and zero overhead for complex analytical SQL compilation. |
| **Protocol Layer** | **Model Context Protocol (MCP)** | Custom REST APIs, GraphQL | Open industry standard supported natively by Claude Desktop, Claude Code, Cursor, and Codex; enables seamless drop-in integration without custom desktop plugins. Uses `stdio` and modern `Streamable HTTP`. |
| **Job Queue & Scheduling** | **Redis 7 + BullMQ** | RabbitMQ, Celery, pg_boss | Dedicated, ultra-fast memory footprint (<50MB); robust scheduling, retries, exponential backoff, dead-letter queues (DLQ), and distributed job locking. |
| **Containerization** | **Docker Compose** | Kubernetes, AWS ECS | Zero control-plane overhead; entire modular monolith runs predictably on a single modest Linux server ($40/month); trivial disaster recovery and local replication. |
| **Edge Proxy** | **Nginx 1.25** | Traefik, Caddy | Proven battle-tested performance; robust rate limiting; SSL termination via Certbot; native request buffering and security headers. |

---

## 8. Architectural Trade-Off Analysis

### 1. Structured SQL vs. Vector RAG for Business Metrics
- **Decision**: All operational and financial metrics originate **strictly from SQL** against the analytics database.
- **Comparison**:
  - *Vector RAG for Numbers*: Prone to stale data, hallucinated calculations, and temporal blindness. In Jarvis v0, this led to reporting net-90 credit terms and outdated unit costs.
  - *Deterministic SQL*: Mathematically exact, verifiable against primary ledgers, respects timezone casting, and adheres to GAAP accounting.

### 2. Managed Supabase vs. Self-Hosted PostgreSQL on VM
- **Decision**: Host analytics and memory on **Supabase Managed PostgreSQL (EU Central)**.
- **Comparison**:
  - *Self-Hosted on VM*: High operational burden (managing physical disk growth, WAL archiving via WAL-G, replica failures, memory contention on modest host).
  - *Supabase Managed*: Automated daily backups + PITR, built-in Supavisor connection pooling, native pgvector support, and zero host database maintenance overhead.

### 3. Read-Only Intelligence vs. Uncontrolled AI Action Execution
- **Decision**: Enforce a strict **Restricted Action Service** requiring explicit human confirmation.
- **Comparison**:
  - *Autonomous Agent Actions*: High risk of erroneous financial transfers or unauthorized customer credit terms.
  - *Human-Confirmed Action Boundary*: Preserves least-privilege security while allowing Jarvis to initiate approved operational workflows seamlessly.

### 4. Modular Monolith vs. Microservices Architecture
- **Decision**: Deploy Jarvis v1 as a **Modular Monolith** in Docker Compose on a single dedicated Hetzner host.
- **Comparison**:
  - *Microservices*: Introduces unnecessary network serialization overhead, distributed tracing complexity, multiple failure points, and high cloud hosting costs ($500+/month).
  - *Modular Monolith*: Extremely fast in-memory communication between orchestrator and engines; single-server deployment; lean infrastructure cost (~$50/month); perfectly matches a 25-person company scale.
