// Core Data Types from /data/ directory (read-only)

export interface BillingPlan {
  plan_id: string;
  customer_name: string;
  total_value: number;
  currency: string;
  cadence: string;
  start_date: string;
  entitlements: string[];
  notes?: string;
  amends?: string; // References parent plan if amended (e.g., "C-1007" in C-1007-A1)
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

// Sandbox Data Types (writable)

export type ProposalType = 'make_good_invoice' | 'credit_memo' | 'plan_amendment';
export type ProposalStatus = 'pending' | 'applied' | 'rejected';

export interface Proposal {
  id: string;
  type: ProposalType;
  status: ProposalStatus;
  created_at: string;
  details: {
    plan_id?: string;
    invoice_id?: string;
    amount?: number;
    currency?: string;
    reason: string;
    changes?: {
      total_value?: number;
      cadence?: string;
      entitlements?: string[];
    };
    [key: string]: any;
  };
}

export interface AppliedAction extends Proposal {
  applied_at: string;
  applied_by?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action_type: string;
  action_id: string;
  performed_by: string;
  details: Record<string, any>;
}

export interface AuditLog {
  entries: AuditLogEntry[];
}

// API Request/Response Types

export interface ChatRequest {
  message?: string;
  mission?: {
    type: 'detect_missing_invoices' | 'detect_overbilling' | 'detect_underbilling' 
          | 'detect_orphans' | 'validate_amendments';
    plan_id?: string;
    customer_name?: string;
    date_range?: {
      start: string;
      end: string;
    };
  };
  conversation_id?: string;
}

export interface ApplyRequest {
  approved_by?: string;
}

export interface ApplyResponse {
  success: boolean;
  action_id?: string;
  message: string;
}

export interface RollbackResponse {
  success: boolean;
  message: string;
}

// SSE Event Types

export type SSEEventType = 'token' | 'tool_use' | 'tool_result' | 'finding' | 'proposal' | 'complete';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  tool?: string;
  args?: Record<string, any>;
  result?: any;
  anomaly?: string;
  details?: any;
  evidence?: string[];
  id?: string;
  action?: string;
  summary?: string;
}

// Frontend State Types

export interface Finding {
  id: string;
  type: string;
  details: string;
  evidence: string[];
}

export interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  streaming?: boolean;
  tool?: string;
  args?: Record<string, any>;
}