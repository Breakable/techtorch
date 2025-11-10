
# Financial Dashboard with AI Agent - System Architecture

## Executive Summary

This document outlines the system architecture for a financial dashboard with an AI-powered chat agent that autonomously detects billing anomalies and proposes corrective actions. Built for rapid development (90-minute implementation window), the system uses NextJS, LangChain, and OpenRouter API to create an intelligent financial detective that reasons through data rather than following fixed rules.

**Key Design Principle:** The AI agent uses LLM-powered reasoning to autonomously investigate anomalies, not predefined pipelines. It decides what tools to call and what actions to propose based on evidence.

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        NextJS Application                             │
│                                                                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    Frontend (React)                            │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐     │  │
│  │  │  Dashboard  │  │ Chat Widget  │  │ Mission Selector │     │  │
│  │  │             │  │              │  │                  │     │  │
│  │  │ • Findings  │  │ • Messages   │  │ • Dropdown menu  │     │  │
│  │  │ • Proposals │  │ • Input box  │  │ • Parameters     │     │  │
│  │  │ • Apply btn │  │ • Streaming  │  │ • Trigger btn    │     │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘     │  │
│  │         │                 │                   │                │  │
│  │         └─────────────────┼───────────────────┘                │  │
│  │                           │                                     │  │
│  └───────────────────────────┼─────────────────────────────────────┐│
│                              │                                     ││
│                              ▼ (SSE/WebSocket)                     ││
│  ┌─────────────────────────────────────────────────────────────┐  ││
│  │                 Backend (API Routes)                         │  ││
│  │                                                               │  ││
│  │  ┌──────────────────┐       ┌────────────────────────┐      │  ││
│  │  │ POST /investigate│       │  LangChain AI Agent    │      │  ││
│  │  │                  │──────►│                        │      │  ││
│  │  │ • Chat message   │       │  • System prompt       │      │  ││
│  │  │ • Mission params │       │  • Tool registry       │      │  ││
│  │  │ • SSE response   │       │  • Reasoning engine    │      │  ││
│  │  └──────────────────┘       │  • Evidence builder    │      │  ││
│  │                             └────────────────────────┘      │  ││
│  │  ┌──────────────────┐       ┌────────────────────────┐      │  ││
│  │  │ POST /apply      │       │  Tool Functions        │      │  ││
│  │  │ POST /rollback   │       │                        │      │  ││
│  │  │ GET /proposals   │◄──────│  • load_plan()         │      │  ││
│  │  │ GET /audit-log   │       │  • query_invoices()    │      │  ││
│  │  └──────────────────┘       │  • fx_convert()        │      │  ││
│  │                             │  • propose_*()         │      │  ││
│  │                             └────────────────────────┘      │  ││
│  └─────────────────────────────────────────────────────────────┘  ││
│                              │                                     ││
└──────────────────────────────┼─────────────────────────────────────┘│
                               │                                      │
                               ▼                                      │
                ┌──────────────────────────────┐                     │
                │     OpenRouter API           │                     │
                │  (Claude 3.5 / GPT-4)        │                     │
                │  • Streaming responses       │                     │
                │  • Function calling          │                     │
                └──────────────────────────────┘                     │
                               │                                      │
                               ▼                                      │
┌──────────────────────────────────────────────────────────────────┐ │
│                        File System Data Layer                     │ │
│                                                                    │ │
│  ┌─────────────────────┐          ┌──────────────────────┐       │ │
│  │    /data/ (Read)    │          │  /sandbox/ (Write)   │       │ │
│  │                     │          │                      │       │ │
│  │ billing_plans.json  │          │ proposals.json       │       │ │
│  │ invoices.json       │          │ applied_actions.json │       │ │
│  │ credit_memos.json   │          │ audit_log.json       │       │ │
│  │ exchange_rates.json │          │                      │       │ │
│  │                     │          │                      │       │ │
│  │ Connected via IDs:  │          │ Generated by agent & │       │ │
│  │ • plan_id           │          │ user approval        │       │ │
│  │ • invoice_id        │          │                      │       │ │
│  │ • memo_id           │          │                      │       │ │
│  └─────────────────────┘          └──────────────────────┘       │ │
│                                                                    │ │
└────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Relationships

The system uses ID-based relationships to connect data across JSON files:

```
billing_plans.json          invoices.json           credit_memos.json
┌──────────────┐           ┌──────────────┐        ┌──────────────┐
│ plan_id      │◄──────────│ plan_id      │◄───────│ plan_id      │
│ customer_name│           │ invoice_id   │◄───────│ invoice_id   │
│ total_value  │           │ customer_name│        │ memo_id      │
│ currency     │           │ amount       │        │ amount       │
│ amends: ref  │           │ status       │        │ reason       │
└──────────────┘           └──────────────┘        └──────────────┘
       │
       │ Plan amendments reference parent:
       │ "amends": "C-1007" (in C-1007-A1)
       └─────────────────────────────────────────────────
```

### 1.3 Interaction Modes

Users can trigger investigations in **two ways**:

**Mode 1: Chat Interface**
- Natural language: "Check if ACME Corp has missing invoices"
- Agent parses intent and autonomously selects tools/approach
- Conversational back-and-forth for clarifications

**Mode 2: Mission Selector (Structured Input)**
- Dropdown: Select mission type (detect overbilling, missing invoices, etc.)
- Parameter fields: plan_id, customer_name, date range
- "Investigate" button triggers agent with structured context

Both modes use the same backend `/api/investigate` endpoint.

### 1.4 Data Flow

**Investigation Flow:**
```
User Action (Chat or Mission Selector)
    ↓
Frontend: POST /api/investigate
    ↓
Backend: Initialize LangChain Agent
    ↓
Agent decides autonomously:
  - Which tools to call (load_plan, query_invoices, fx_convert)
  - What order (multi-step reasoning)
  - What anomalies exist
    ↓
Agent streams reasoning (SSE)
    ↓
Frontend: Display token-by-token in chat + update findings table
    ↓
Agent creates proposals using propose_*() tools
    ↓
Frontend: Display in proposals table with "Apply" buttons
```

**Apply Flow:**
```
User clicks "Apply" on proposal
    ↓
Frontend: POST /api/apply
    ↓
Backend: Validate proposal, write to sandbox/applied_actions.json
    ↓
Backend: Append to sandbox/audit_log.json
    ↓
Frontend: Update UI, mark proposal as "Applied"
```

**Rollback Flow:**
```
User clicks "Rollback" on applied action
    ↓
Frontend: POST /api/rollback
    ↓
Backend: Mark action as reversed in sandbox
    ↓
Backend: Log rollback in audit_log.json
    ↓
Frontend: Update UI
```

---

## 2. Project Structure

### 2.1 Simplified Directory Tree (90-Minute Build Focus)

```
financial-dashboard/
├── .env                              # OPEN_ROUTER=sk-or-v1-...
├── .gitignore
├── package.json
├── next.config.js
├── tsconfig.json
├── tailwind.config.js
├── README.md
│
├── data/                             # Provided data files (read-only)
│   ├── billing_plans.json           # Contracts with plan_id
│   ├── invoices.json                # Invoices linked via plan_id
│   ├── credit_memos.json            # Credits linked via invoice_id/plan_id
│   └── exchange_rates.json          # EUR ↔ USD rates
│
├── sandbox/                          # Writable outputs (JSON files)
│   ├── proposals.json               # Agent-generated proposals
│   ├── applied_actions.json         # User-approved actions
│   └── audit_log.json               # Chronological log
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Main dashboard page
│   │   ├── globals.css              # Tailwind base styles
│   │   │
│   │   └── api/                     # Backend API routes
│   │       ├── chat/
│   │       │   └── route.ts         # POST /api/chat (SSE streaming)
│   │       ├── apply/
│   │       │   └── route.ts         # POST /api/apply/{proposalId}
│   │       ├── rollback/
│   │       │   └── route.ts         # POST /api/rollback/{actionId}
│   │       └── data/
│   │           └── route.ts         # GET /api/data (proposals, audit log)
│   │
│   ├── components/
│   │   ├── Dashboard.tsx            # Main dashboard container
│   │   ├── ChatWidget.tsx           # Chat interface with streaming
│   │   ├── MissionSelector.tsx      # Dropdown mission picker
│   │   ├── FindingsTable.tsx        # Display detected anomalies
│   │   ├── ProposalsTable.tsx       # Display proposals with Apply buttons
│   │   └── ui/                      # Tailwind utility components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Table.tsx
│   │
│   ├── lib/
│   │   ├── agent/                   # AI Agent core
│   │   │   ├── langchain-agent.ts  # LangChain setup + tools
│   │   │   ├── prompts.ts          # System prompts
│   │   │   └── tools/              # Individual tool implementations
│   │   │       ├── load-plan.ts
│   │   │       ├── query-invoices.ts
│   │   │       ├── fx-convert.ts
│   │   │       ├── propose-make-good.ts
│   │   │       ├── propose-credit.ts
│   │   │       └── propose-amendment.ts
│   │   │
│   │   ├── data/                    # Data access
│   │   │   ├── loader.ts           # Read JSON files
│   │   │   └── sandbox.ts          # Write to sandbox JSON
│   │   │
│   │   └── utils/
│   │       ├── streaming.ts        # SSE helpers
│   │       └── types.ts            # TypeScript interfaces
│   │
│   └── types/
│       └── index.ts                 # Shared types
│
└── public/
    └── (static assets if needed)
```

**Key Design Decisions for Rapid Development:**

1. **Minimal file structure**: Combined related functionality to reduce setup time
2. **Flat sandbox**: All sandbox data in 3 JSON files at root level (not subdirectories)
3. **Simplified state**: React Context instead of Redux/Zustand
4. **Tailwind classes**: Direct styling instead of complex component library setup
5. **Single chat endpoint**: `/api/chat` handles both modes (chat + mission selector)

---

## 3. Backend Architecture

### 3.1 API Routes

#### 3.1.1 POST `/api/chat`

**Purpose:** Universal endpoint for both chat messages and mission-based investigations

**Request Body:**
```typescript
{
  // Option 1: Natural language chat
  message?: string,
  
  // Option 2: Structured mission
  mission?: {
    type: "detect_missing_invoices" | "detect_overbilling" | "detect_underbilling"
          | "detect_orphans" | "validate_amendments",
    plan_id?: string,
    customer_name?: string,
    date_range?: { start: string, end: string }
  },
  
  // Conversation context
  conversation_id?: string
}
```

**Response:** Server-Sent Events (SSE) - token-by-token streaming

**Event Stream Format:**
```
data: {"type":"token","content":"Investigating"}
data: {"type":"token","content":" plan"}
data: {"type":"token","content":" C-1001"}
data: {"type":"tool_use","tool":"load_plan","args":{"plan_id":"C-1001"}}
data: {"type":"tool_result","tool":"load_plan","result":{...}}
data: {"type":"finding","anomaly":"missing_invoice","details":{...}}
data: {"type":"proposal","id":"prop-123","action":"make_good_invoice","details":{...}}
data: {"type":"complete","summary":"Found 1 anomaly, created 1 proposal"}
```

**Implementation Overview:**
```typescript
// src/app/api/chat/route.ts
export async function POST(req: Request) {
  const { message, mission } = await req.json();
  
  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Initialize LangChain agent with streaming callbacks
  const agent = createFinancialAgent({
    onToken: (token) => {
      writer.write(encoder.encode(`data: ${JSON.stringify({type:'token',content:token})}\n\n`));
    },
    onToolCall: (tool, args) => {
      writer.write(encoder.encode(`data: ${JSON.stringify({type:'tool_use',tool,args})}\n\n`));
    }
  });
  
  // Run agent asynchronously
  (async () => {
    try {
      const input = message || formatMissionPrompt(mission);
      await agent.invoke(input);
      writer.write(encoder.encode(`data: ${JSON.stringify({type:'complete'})}\n\n`));
    } finally {
      writer.close();
    }
  })();
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

#### 3.1.2 POST `/api/apply/{proposalId}`

**Purpose:** Apply approved proposal to sandbox

**URL Parameter:** `proposalId` - ID of proposal to apply

**Request Body:**
```typescript
{
  approved_by?: string  // Optional user identifier
}
```

**Response:**
```typescript
{
  success: true,
  action_id: "action-456",
  message: "Make-good invoice applied to sandbox"
}
```

**Logic:**
1. Load proposal from `sandbox/proposals.json`
2. Validate proposal still pending
3. Write to `sandbox/applied_actions.json`
4. Update proposal status to "applied"
5. Append audit log entry

#### 3.1.3 POST `/api/rollback/{actionId}`

**Purpose:** Reverse a previously applied action

**URL Parameter:** `actionId` - ID of action to rollback

**Response:**
```typescript
{
  success: true,
  message: "Action rolled back successfully"
}
```

**Logic:**
1. Find action in `sandbox/applied_actions.json`
2. Mark as `status: "rolled_back"`
3. Log rollback in audit log

#### 3.1.4 GET `/api/data`

**Purpose:** Fetch current proposals and audit log

**Query Parameters:**
- `?type=proposals` - Get all proposals
- `?type=audit` - Get audit log
- `?type=all` - Get both

**Response:**
```typescript
{
  proposals: [...],
  audit_log: [...]
}
```

### 3.2 Data Access Layer

**File:** `src/lib/data/loader.ts`

Simple synchronous JSON file loading with TypeScript types:

```typescript
import fs from 'fs';
import path from 'path';

export interface BillingPlan {
  plan_id: string;
  customer_name: string;
  total_value: number;
  currency: string;
  cadence: string;
  start_date: string;
  entitlements: string[];
  notes?: string;
  amends?: string;  // References parent plan if amended
}

export interface Invoice {
  invoice_id: string;
  plan_id: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  amount_invoiced: number;
  currency: string;
  status: string;
  description: string;
}

export interface CreditMemo {
  memo_id: string;
  plan_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  issue_date: string;
  reason: string;
}

export interface ExchangeRate {
  date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
}

// Simple cached loaders
let plansCache: BillingPlan[] | null = null;
let invoicesCache: Invoice[] | null = null;
let memosCache: CreditMemo[] | null = null;
let ratesCache: ExchangeRate[] | null = null;

export function loadBillingPlans(): BillingPlan[] {
  if (!plansCache) {
    const data = fs.readFileSync(path.join(process.cwd(), 'data/billing_plans.json'), 'utf-8');
    plansCache = JSON.parse(data);
  }
  return plansCache!;
}

export function loadInvoices(): Invoice[] {
  if (!invoicesCache) {
    const data = fs.readFileSync(path.join(process.cwd(), 'data/invoices.json'), 'utf-8');
    invoicesCache = JSON.parse(data);
  }
  return invoicesCache!;
}

// Query helpers
export function getPlanById(planId: string): BillingPlan | null {
  return loadBillingPlans().find(p => p.plan_id === planId) || null;
}

export function getInvoicesByPlan(planId: string): Invoice[] {
  return loadInvoices().filter(inv => inv.plan_id === planId);
}

export function getFxRate(from: string, to: string, date: string): number | null {
  if (!ratesCache) {
    const data = fs.readFileSync(path.join(process.cwd(), 'data/exchange_rates.json'), 'utf-8');
    ratesCache = JSON.parse(data);
  }
  const rate = ratesCache.find(r =>
    r.from_currency === from &&
    r.to_currency === to &&
    r.date === date
  );
  return rate?.rate || null;
}
```

### 3.3 Sandbox Management

**File:** `src/lib/data/sandbox.ts`

Simplified JSON file writes for proposals, applied actions, and audit log:

```typescript
import fs from 'fs';
import path from 'path';

const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');

export interface Proposal {
  id: string;
  type: 'make_good_invoice' | 'credit_memo' | 'plan_amendment';
  status: 'pending' | 'applied' | 'rejected';
  created_at: string;
  details: {
    plan_id?: string;
    invoice_id?: string;
    amount?: number;
    currency?: string;
    reason: string;
    [key: string]: any;
  };
}

export interface AppliedAction extends Proposal {
  applied_at: string;
  applied_by?: string;
}

// Read/write sandbox JSON files
export function loadProposals(): Proposal[] {
  const file = path.join(SANDBOX_DIR, 'proposals.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function saveProposals(proposals: Proposal[]): void {
  const file = path.join(SANDBOX_DIR, 'proposals.json');
  fs.writeFileSync(file, JSON.stringify(proposals, null, 2));
}

export function createProposal(type: Proposal['type'], details: Proposal['details']): string {
  const proposals = loadProposals();
  const id = `prop-${Date.now()}`;
  
  proposals.push({
    id,
    type,
    status: 'pending',
    created_at: new Date().toISOString(),
    details
  });
  
  saveProposals(proposals);
  logAudit('proposal_created', id, 'AI Agent', { type, details });
  
  return id;
}

export function applyProposal(proposalId: string, approver?: string): string {
  const proposals = loadProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  
  if (!proposal || proposal.status !== 'pending') {
    throw new Error('Proposal not found or already processed');
  }
  
  // Update proposal status
  proposal.status = 'applied';
  saveProposals(proposals);
  
  // Add to applied actions
  const actions = loadAppliedActions();
  const actionId = `action-${Date.now()}`;
  actions.push({
    ...proposal,
    applied_at: new Date().toISOString(),
    applied_by: approver
  });
  saveAppliedActions(actions);
  
  logAudit('action_applied', actionId, approver || 'user', { proposalId });
  
  return actionId;
}

export function rollbackAction(actionId: string): void {
  const actions = loadAppliedActions();
  const action = actions.find(a => a.id === actionId);
  
  if (!action) {
    throw new Error('Action not found');
  }
  
  action.status = 'rolled_back' as any;
  saveAppliedActions(actions);
  
  logAudit('action_rolled_back', actionId, 'user', {});
}

function logAudit(type: string, actionId: string, performer: string, details: any): void {
  const file = path.join(SANDBOX_DIR, 'audit_log.json');
  let log = { entries: [] as any[] };
  
  if (fs.existsSync(file)) {
    log = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  
  log.entries.push({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action_type: type,
    action_id: actionId,
    performed_by: performer,
    details
  });
  
  fs.writeFileSync(file, JSON.stringify(log, null, 2));
}
```

**Sandbox File Formats:**

**proposals.json:**
```json
[
  {
    "id": "prop-1699876543210",
    "type": "make_good_invoice",
    "status": "pending",
    "created_at": "2025-11-10T14:30:00Z",
    "details": {
      "plan_id": "C-1001",
      "amount": 8000,
      "currency": "USD",
      "reason": "Missing September 2025 invoice detected"
    }
  }
]
```

**applied_actions.json:**
```json
[
  {
    "id": "prop-1699876543210",
    "type": "make_good_invoice",
    "status": "applied",
    "created_at": "2025-11-10T14:30:00Z",
    "applied_at": "2025-11-10T14:35:00Z",
    "applied_by": "user@example.com",
    "details": { ... }
  }
]
```

---

## 4. AI Agent Design

### 4.1 LangChain Agent Architecture

**Agent Type:** OpenAI Functions Agent (or Tool Calling Agent)

**Core Components:**

1. **LLM:** Claude 3.5 Sonnet or GPT-4 via OpenRouter
2. **Memory:** Conversation buffer memory for multi-step reasoning
3. **Tools:** 8 custom tools (see section 4.2)
4. **Prompt:** System prompt defining role, capabilities, constraints

**File:** `src/lib/ai/agent.ts`

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tools } from "./tools";
import { systemPrompt } from "./prompts";

export async function createFinancialAgent(callbacks: AgentCallbacks) {
  const llm = new ChatOpenAI({
    modelName: "anthropic/claude-3.5-sonnet",
    openAIApiKey: process.env.OPEN_ROUTER,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1"
    },
    streaming: true,
    callbacks: [
      {
        handleLLMNewToken: (token) => callbacks.onToken?.(token),
        // ... other callbacks
      }
    ]
  });
  
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"]
  ]);
  
  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt
  });
  
  const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 15
  });
  
  return {
    async investigate(mission: string, parameters: object) {
      const input = formatMissionInput(mission, parameters);
      const result = await executor.invoke({ input });
      return parseAgentOutput(result);
    }
  };
}
```

### 4.2 Tool Definitions

**File:** `src/lib/ai/tools.ts`

Each tool is a LangChain StructuredTool with:
- Name
- Description (for LLM to understand when to use it)
- Input schema (Zod validation)
- Implementation function

#### Tool 1: `load_plan`

```typescript
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";

export const loadPlanTool = new StructuredTool({
  name: "load_plan",
  description: "Retrieve billing plan details by plan ID. Use this to understand the contract terms, total value, billing cadence, and entitlements.",
  schema: z.object({
    plan_id: z.string().describe("The billing plan ID (e.g., C-1001)")
  }),
  func: async ({ plan_id }) => {
    const dataLoader = new DataLoader();
    const plan = await dataLoader.getPlanById(plan_id);
    
    if (!plan) {
      return `Error: Plan ${plan_id} not found`;
    }
    
    return JSON.stringify(plan, null, 2);
  }
});
```

#### Tool 2: `query_invoices`

```typescript
export const queryInvoicesTool = new StructuredTool({
  name: "query_invoices",
  description: "Filter invoices by plan ID, customer name, or date range. Returns matching invoices with details.",
  schema: z.object({
    plan_id: z.string().optional(),
    customer_name: z.string().optional(),
    date_from: z.string().optional().describe("ISO date string"),
    date_to: z.string().optional().describe("ISO date string")
  }),
  func: async (filters) => {
    const dataLoader = new DataLoader();
    let invoices = await dataLoader.loadInvoices();
    
    // Apply filters
    if (filters.plan_id) {
      invoices = invoices.filter(inv => inv.plan_id === filters.plan_id);
    }
    if (filters.customer_name) {
      invoices = invoices.filter(inv => inv.customer_name === filters.customer_name);
    }
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? new Date(filters.date_from) : null;
      const to = filters.date_to ? new Date(filters.date_to) : null;
      invoices = invoices.filter(inv => {
        const issueDate = new Date(inv.issue_date);
        if (from && issueDate < from) return false;
        if (to && issueDate > to) return false;
        return true;
      });
    }
    
    return JSON.stringify({
      count: invoices.length,
      invoices
    }, null, 2);
  }
});
```

#### Tool 3: `fx_convert`

```typescript
export const fxConvertTool = new StructuredTool({
  name: "fx_convert",
  description: "Convert an amount from one currency to another using historical exchange rates for a specific date.",
  schema: z.object({
    amount: z.number(),
    from_currency: z.string(),
    to_currency: z.string(),
    date: z.string().describe("ISO date string")
  }),
  func: async ({ amount, from_currency, to_currency, date }) => {
    if (from_currency === to_currency) {
      return JSON.stringify({ 
        original_amount: amount, 
        converted_amount: amount, 
        rate: 1.0 
      });
    }
    
    const dataLoader = new DataLoader();
    const rate = await dataLoader.getFxRate(from_currency, to_currency, new Date(date));
    
    if (!rate) {
      return `Error: No FX rate found for ${from_currency}→${to_currency} on ${date}`;
    }
    
    const converted = amount * rate;
    return JSON.stringify({
      original_amount: amount,
      from_currency,
      converted_amount: converted,
      to_currency,
      rate,
      date
    });
  }
});
```

#### Tool 4: `propose_make_good_invoice`

```typescript
export const proposeMakeGoodTool = new StructuredTool({
  name: "propose_make_good_invoice",
  description: "Create a proposal for a make-good invoice to recover missing or underbilled revenue. This does NOT apply the invoice; it creates a proposal for human approval.",
  schema: z.object({
    plan_id: z.string(),
    amount: z.number(),
    currency: z.string(),
    reason: z.string().describe("Clear explanation with evidence")
  }),
  func: async (params) => {
    const sandbox = new SandboxManager();
    const proposalId = await sandbox.createProposal("make_good_invoice", {
      ...params,
      proposed_at: new Date().toISOString()
    });
    
    return JSON.stringify({
      proposal_id: proposalId,
      type: "make_good_invoice",
      status: "pending_approval",
      details: params
    });
  }
});
```

#### Tool 5: `propose_credit_memo`

```typescript
export const proposeCreditMemoTool = new StructuredTool({
  name: "propose_credit_memo",
  description: "Create a proposal for a credit memo to correct overbilling. This does NOT apply the credit; it creates a proposal for human approval.",
  schema: z.object({
    invoice_id: z.string(),
    amount: z.number(),
    currency: z.string(),
    reason: z.string()
  }),
  func: async (params) => {
    const sandbox = new SandboxManager();
    const proposalId = await sandbox.createProposal("credit_memo", {
      ...params,
      proposed_at: new Date().toISOString()
    });
    
    return JSON.stringify({
      proposal_id: proposalId,
      type: "credit_memo",
      status: "pending_approval",
      details: params
    });
  }
});
```

#### Tool 6: `propose_plan_amendment`

```typescript
export const proposePlanAmendmentTool = new StructuredTool({
  name: "propose_plan_amendment",
  description: "Create a proposal to amend a billing plan (update total value, cadence, entitlements). This does NOT apply the amendment; it creates a proposal for human approval.",
  schema: z.object({
    plan_id: z.string(),
    changes: z.object({
      total_value: z.number().optional(),
      cadence: z.string().optional(),
      entitlements: z.array(z.string()).optional()
    }),
    reason: z.string()
  }),
  func: async (params) => {
    const sandbox = new SandboxManager();
    const proposalId = await sandbox.createProposal("plan_amendment", {
      ...params,
      proposed_at: new Date().toISOString()
    });
    
    return JSON.stringify({
      proposal_id: proposalId,
      type: "plan_amendment",
      status: "pending_approval",
      details: params
    });
  }
});
```

#### Tool 7: `apply` (restricted access)

```typescript
// NOTE: This tool is NOT directly available to the agent during investigation.
// It's only called by the backend when user clicks "Apply" button.

export async function applyAction(proposalId: string, approver: string) {
  const sandbox = new SandboxManager();
  const actionId = await sandbox.applyProposal(proposalId, approver);
  return { success: true, action_id: actionId };
}
```

#### Tool 8: `rollback` (restricted access)

```typescript
// NOTE: This tool is NOT directly available to the agent during investigation.
// It's only called by the backend when user clicks "Rollback" button.

export async function rollbackAction(actionId: string, reason: string) {
  const sandbox = new SandboxManager();
  await sandbox.rollbackAction(actionId, reason);
  return { success: true };
}
```

### 4.3 Prompt Engineering Strategy

**File:** `src/lib/ai/prompts.ts`

```typescript
export const systemPrompt = `You are a financial detective AI agent specializing in revenue leakage detection and billing reconciliation.

## Your Role
You autonomously investigate billing anomalies by:
1. Analyzing billing plans and invoices
2. Identifying discrepancies (missing invoices, overbilling, underbilling, orphans, amendment tracking issues)
3. Proposing corrective actions with clear evidence and reasoning

## Available Tools
You have access to 6 tools:
- load_plan: Get billing plan details
- query_invoices: Filter invoices by various criteria
- fx_convert: Perform currency conversions with historical rates
- propose_make_good_invoice: Draft a recovery invoice (requires approval)
- propose_credit_memo: Draft a credit for overbilling (requires approval)
- propose_plan_amendment: Draft a plan update (requires approval)

## Investigation Principles
1. **Evidence-based:** Always cite specific data (invoice IDs, amounts, dates)
2. **Multi-step reasoning:** Break down complex problems
3. **Currency-aware:** Use fx_convert when comparing cross-currency amounts
4. **Amendment-tracking:** Check for plan amendments (e.g., C-1007 → C-1007-A1)
5. **Clear explanations:** Justify every proposal with calculations

## Anomaly Types to Detect
1. **Missing invoices:** Expected monthly/quarterly invoice not found
2. **Overbilling:** Invoice amount exceeds expected (check FX rates!)
3. **Underbilling:** Invoice amount less than expected
4. **Orphan invoices:** Invoice with no plan_id or invalid reference
5. **Amendment issues:** Invoices billed against superseded plans

## Response Format
When you detect an anomaly:
1. State the finding clearly
2. Show your evidence (plan details, invoice data, calculations)
3. Propose a corrective action
4. Explain why this action fixes the issue

## Important Constraints
- You CANNOT directly apply actions (no database writes)
- Proposals require human approval
- Work with data in /data/ directory (read-only)
- All proposals go to sandbox for review

Think step-by-step and show your reasoning.`;
```

**Mission-Specific Prompts:**

When user selects a mission, the agent receives context like:

```typescript
function formatMissionInput(mission: string, params: object): string {
  const missionPrompts = {
    detect_missing_invoices: `
Mission: Detect Missing Invoices
Plan ID: ${params.plan_id}

Investigate if all expected invoices have been issued according to the billing plan's cadence.
Steps:
1. Load the billing plan to understand cadence and total value
2. Query all invoices for this plan
3. Calculate expected invoice dates based on cadence
4. Identify any missing invoices
5. Propose make-good invoices for missing periods
`,
    detect_overbilling: `
Mission: Detect Overbilling
Customer: ${params.customer_name || 'all customers'}

Look for invoices that exceed expected amounts. Common causes:
- Incorrect currency conversion (check FX rates!)
- Duplicate invoicing
- Billing against superseded plan

Steps:
1. Load relevant plans
2. Query invoices
3. Compare invoice amounts with plan expectations
4. Use fx_convert for cross-currency comparisons
5. Propose credit memos where overbilling occurred
`,
    // ... other missions
  };
  
  return missionPrompts[mission] || `Investigate: ${mission}`;
}
```

### 4.4 Evidence Citation Mechanism

**Strategy:** The agent should reference specific data in its reasoning:

Example agent output:
```
**Plan:** C-1001 (ACME Corp) - Monthly cadence, $8000/month
**Evidence:**
- Invoice I-9008 issued 2025-08-05 ✓
- Invoice I-9010 issued 2025-10-05 ✓
- **Gap:** No invoice for September 2025 (expected ~2025-09-05)

**Calculation:**
Expected monthly: $96,000 / 12 = $8,000
Missing: September 2025

**Proposal:** Create make-good invoice for $8,000 USD for September 2025 billing period.
```

The LLM naturally cites evidence when prompted correctly. The key is the system prompt emphasizing "cite specific data" and tool results being structured JSON.

---

## 5. Frontend Architecture

### 5.1 Component Hierarchy

```
App (page.tsx)
│
├── DashboardContext.Provider
│   │
│   └── Dashboard.tsx
│       ├── Header
│       │
│       ├── Left Panel
│       │   └── MissionSelector.tsx
│       │       ├── <select> Mission type
│       │       ├── <input> Parameters (plan_id, customer, dates)
│       │       └── <button> Investigate
│       │
│       ├── Center Panel
│       │   └── ChatWidget.tsx
│       │       ├── MessageList
│       │       │   ├── UserMessage
│       │       │   ├── AgentMessage (streaming)
│       │       │   └── ToolCallMessage
│       │       └── InputBox
│       │           ├── <textarea> Message
│       │           └── <button> Send
│       │
│       └── Right Panel (Tables)
│           ├── FindingsTable.tsx
│           │   └── Rows (anomaly type, details, evidence)
│           │
│           └── ProposalsTable.tsx
│               └── Rows (proposal type, amount, Apply button)
```

### 5.2 State Management (React Context)

**File:** `src/context/DashboardContext.tsx`

```typescript
import React, { createContext, useContext, useState } from 'react';

interface Finding {
  id: string;
  type: string;
  details: string;
  evidence: string[];
}

interface Proposal {
  id: string;
  type: 'make_good_invoice' | 'credit_memo' | 'plan_amendment';
  status: 'pending' | 'applied';
  amount?: number;
  currency?: string;
  reason: string;
}

interface DashboardState {
  findings: Finding[];
  proposals: Proposal[];
  messages: ChatMessage[];
  isInvestigating: boolean;
}

interface DashboardContextType {
  state: DashboardState;
  addFinding: (finding: Finding) => void;
  addProposal: (proposal: Proposal) => void;
  addMessage: (message: ChatMessage) => void;
  applyProposal: (proposalId: string) => Promise<void>;
  setInvestigating: (value: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DashboardState>({
    findings: [],
    proposals: [],
    messages: [],
    isInvestigating: false
  });

  const addFinding = (finding: Finding) => {
    setState(prev => ({ ...prev, findings: [...prev.findings, finding] }));
  };

  const addProposal = (proposal: Proposal) => {
    setState(prev => ({ ...prev, proposals: [...prev.proposals, proposal] }));
  };

  const addMessage = (message: ChatMessage) => {
    setState(prev => ({ ...prev, messages: [...prev.messages, message] }));
  };

  const applyProposal = async (proposalId: string) => {
    const response = await fetch(`/api/apply/${proposalId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'user' })
    });
    
    if (response.ok) {
      setState(prev => ({
        ...prev,
        proposals: prev.proposals.map(p =>
          p.id === proposalId ? { ...p, status: 'applied' } : p
        )
      }));
    }
  };

  const setInvestigating = (value: boolean) => {
    setState(prev => ({ ...prev, isInvestigating: value }));
  };

  return (
    <DashboardContext.Provider value={{
      state,
      addFinding,
      addProposal,
      addMessage,
      applyProposal,
      setInvestigating
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
};
```

### 5.3 SSE Streaming Hook

**File:** `src/hooks/useInvestigation.ts`

```typescript
import { useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';

export function useInvestigation() {
  const { addMessage, addFinding, addProposal, setInvestigating } = useDashboard();

  const investigate = useCallback(async (params: { message?: string; mission?: any }) => {
    setInvestigating(true);
    
    // Add user message to chat
    if (params.message) {
      addMessage({ role: 'user', content: params.message });
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentMessage = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            switch (data.type) {
              case 'token':
                currentMessage += data.content;
                // Update last message in real-time
                addMessage({ role: 'agent', content: currentMessage, streaming: true });
                break;

              case 'tool_use':
                addMessage({
                  role: 'system',
                  content: `🔧 Using tool: ${data.tool}`,
                  tool: data.tool,
                  args: data.args
                });
                break;

              case 'finding':
                addFinding({
                  id: `finding-${Date.now()}`,
                  type: data.anomaly,
                  details: data.details,
                  evidence: data.evidence || []
                });
                break;

              case 'proposal':
                addProposal({
                  id: data.id,
                  type: data.action,
                  status: 'pending',
                  ...data.details
                });
                break;

              case 'complete':
                addMessage({ role: 'agent', content: currentMessage, streaming: false });
                break;
            }
          }
        }
      }
    } finally {
      setInvestigating(false);
    }
  }, [addMessage, addFinding, addProposal, setInvestigating]);

  return { investigate };
}
```

### 5.4 Key Component: ChatWidget

**File:** `src/components/ChatWidget.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useInvestigation } from '../hooks/useInvestigation';

export function ChatWidget() {
  const [input, setInput] = useState('');
  const { state } = useDashboard();
  const { investigate } = useInvestigation();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    await investigate({ message: input });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {state.messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : msg.role === 'system'
                ? 'bg-gray-200 text-gray-700 text-sm'
                : 'bg-gray-100 text-gray-900'
            }`}>
              {msg.content}
              {msg.streaming && <span className="animate-pulse">▌</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about billing anomalies..."
            className="flex-1 border rounded-lg p-2 resize-none"
            rows={2}
            disabled={state.isInvestigating}
          />
          <button
            onClick={handleSend}
            disabled={state.isInvestigating || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            {state.isInvestigating ? 'Investigating...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 5.5 Key Component: ProposalsTable

**File:** `src/components/ProposalsTable.tsx`

```typescript
'use client';
import { useDashboard } from '../context/DashboardContext';

export function ProposalsTable() {
  const { state, applyProposal } = useDashboard();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-bold mb-4">Proposals</h2>
      
      {state.proposals.length === 0 ? (
        <p className="text-gray-500">No proposals yet</p>
      ) : (
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Amount</th>
              <th className="text-left p-2">Reason</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {state.proposals.map(proposal => (
              <tr key={proposal.id} className="border-b">
                <td className="p-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {proposal.type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-2">
                  {proposal.amount && `${proposal.currency} ${proposal.amount.toLocaleString()}`}
                </td>
                <td className="p-2 text-sm">{proposal.reason.slice(0, 100)}...</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-sm ${
                    proposal.status === 'applied'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {proposal.status}
                  </span>
                </td>
                <td className="p-2">
                  {proposal.status === 'pending' && (
                    <button
                      onClick={() => applyProposal(proposal.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Apply
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## 6. Security & Configuration

### 6.1 Environment Variables

**File:** `.env`

```bash
# OpenRouter API Configuration
OPEN_ROUTER=sk-or-v1-your-api-key-here

# Optional: Model selection
AI_MODEL=anthropic/claude-3.5-sonnet

# Optional: ChromaDB (if implementing RAG)
CHROMA_DB_PATH=./chromadb

# Security
NODE_ENV=development
```

**Security Best Practices:**
1. Never commit `.env` to git (use `.gitignore`)
2. API key only accessed server-side (API routes)
3. Validate all user inputs
4. Sanitize file paths to prevent directory traversal
5. Rate limit API endpoints to prevent abuse

### 6.2 Sandbox Isolation

**Strategy:**
- Sandbox files completely separate from production data
- Read-only access to `/data/` directory
- Write access only to `/sandbox/` directory
- All modifications logged in audit log
- Rollback capability preserves history

**File System Permissions:**
```
/data/           → Read-only (contains source data)
/sandbox/        → Read/write (for proposals and actions)
  proposals.json       → Agent can write, user can view
  applied_actions.json → Only written after user approval
  audit_log.json       → Append-only log
```

---

## 7. Implementation Phases

### Phase 1: Core Data & Backend (30 minutes)

**Priority 1:**
1. Set up NextJS project with TypeScript
2. Install dependencies: `langchain`, `@langchain/openai`, `zod`
3. Create data loader (`src/lib/data/loader.ts`)
4. Create sandbox manager (`src/lib/data/sandbox.ts`)
5. Initialize empty sandbox JSON files

**Deliverable:** Working data access layer

### Phase 2: AI Agent (30 minutes)

**Priority 2:**
1. Create tool definitions (6 tools)
2. Set up LangChain agent with OpenRouter
3. Implement system prompts
4. Create `/api/chat` endpoint with SSE streaming
5. Test agent with simple chat message

**Deliverable:** Working AI agent that can call tools

### Phase 3: Frontend UI (25 minutes)

**Priority 3:**
1. Create `DashboardContext` for state management
2. Build `ChatWidget` with SSE connection
3. Build `MissionSelector` component
4. Build `ProposalsTable` with Apply button
5. Build `FindingsTable`
6. Style with Tailwind CSS

**Deliverable:** Complete UI with agent integration

### Phase 4: Apply & Rollback (5 minutes)

**Priority 4:**
1. Create `/api/apply/{proposalId}` endpoint
2. Create `/api/rollback/{actionId}` endpoint  
3. Connect Apply button to API
4. Test full workflow

**Deliverable:** Complete application with all features

---

## 8. Optional: ChromaDB Integration (Future Enhancement)

**Use Case:** Store investigation history and reasoning patterns for RAG

**Implementation:**
```typescript
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

// Store investigation results
async function storeInvestigation(investigation: {
  query: string;
  findings: string;
  reasoning: string;
}) {
  const vectorStore = await Chroma.fromTexts(
    [investigation.reasoning],
    [{ query: investigation.query, findings: investigation.findings }],
    new OpenAIEmbeddings({ openAIApiKey: process.env.OPEN_ROUTER }),
    { collectionName: "investigations" }
  );
}

// Retrieve similar past investigations
async function getSimilarInvestigations(query: string) {
  const vectorStore = await Chroma.fromExistingCollection(
    new OpenAIEmbeddings({ openAIApiKey: process.env.OPEN_ROUTER }),
    { collectionName: "investigations" }
  );
  
  const results = await vectorStore.similaritySearch(query, 3);
  return results;
}
```

**When to Use:**
- After initial implementation works
- If agent needs to learn from past investigations
- To provide context: "Similar anomaly was found in..."

**Note:** Not critical for 90-minute build. Focus on core functionality first.

---

## 9. Testing Strategy

**Manual Testing Scenarios:**

1. **Missing Invoice Detection:**
   - Mission: "Detect missing invoices for C-1001"
   - Expected: Agent finds September 2025 gap
   - Proposal: Make-good invoice for $8,000

2. **Overbilling Detection:**
   - Mission: "Check Globex Ltd for overbilling"
   - Expected: Finds I-9123 FX conversion issue
   - Proposal: Credit memo adjustment

3. **Orphan Invoice:**
   - Mission: "Find orphan invoices"
   - Expected: Identifies I-9202 with empty plan_id
   - Proposal: Plan amendment or investigation

4. **Chat Interface:**
   - Message: "Are all ACME Corp invoices correct?"
   - Expected: Agent autonomously investigates C-1001

5. **Apply & Rollback:**
   - Apply a proposal → Check sandbox JSON updated
   - Rollback → Check status marked as rolled_back

---

## 10. Deployment Considerations

**Development:**
```bash
npm run dev
# → http://localhost:3000
```

**Production:**
```bash
npm run build
npm start
```

**Environment:**
- Ensure `OPEN_ROUTER` API key is set
- Verify `/data/` and `/sandbox/` directories exist
- Check file permissions

**Monitoring:**
- Track API costs via OpenRouter dashboard
- Monitor `/sandbox/audit_log.json` for user actions
- Log LLM token usage

---

## 11. Architecture Summary

**Key Strengths:**

1. **Autonomous Agent:** Uses LLM reasoning, not hardcoded rules
2. **Evidence-Based:** All proposals backed by data references
3. **Human-in-Loop:** Requires approval before applying actions
4. **Auditable:** Complete trail in audit log
5. **Reversible:** Rollback capability for safety
6. **Rapid Development:** Optimized for 90-minute build
7. **Type-Safe:** Full TypeScript coverage
8. **Scalable:** Can add more tools/missions easily

**Trade-offs:**

1. **File-Based Storage:** JSON files instead of database (simpler, good for demo)
2. **Simple State:** React Context vs Redux (faster to build)
3. **No Authentication:** Focus on core functionality
4. **Minimal Error Handling:** Can be enhanced post-MVP
5. **No ChromaDB Initially:** Can add later if needed

**Success Metrics:**

- ✅ Agent detects all anomaly types in sample data
- ✅ Proposals include clear evidence and reasoning
- ✅ Apply button writes to sandbox correctly
- ✅ Rollback functionality works
- ✅ Streaming chat provides real-time feedback
- ✅ Mission selector triggers investigations
- ✅ Audit log tracks all actions

---

## Appendix A: Sample Data Analysis

Based on provided data files:

**Detected Anomalies:**
1. **C-1001 (ACME Corp):** Missing September 2025 invoice
2. **C-1007-A1 (Globex):** Invoice I-9123 in EUR needs FX verification  
3. **C-1010 (Initech):** Only 1 invoice for annual plan (may be correct or missing)
4. **Orphan:** Invoice I-9202 has no plan_id

**Expected Agent Behavior:**
- Load plans to understand expectations
- Query invoices to find gaps
- Use FX conversion for I-9123 (EUR 25,000 → USD)
- Propose make-good for September C-1001
- Investigate orphan I-9202

---

**End of Architecture Document**
Finding: Missing invoice