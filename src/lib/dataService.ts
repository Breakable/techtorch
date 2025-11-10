import fs from 'fs';
import path from 'path';
import {
  BillingPlan,
  Invoice,
  CreditMemo,
  ExchangeRate,
  Proposal,
  AppliedAction,
  AuditLog,
  AuditLogEntry,
  ProposalType
} from '@/types';

// Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const SANDBOX_DIR = path.join(process.cwd(), 'sandbox');

// Cache for read-only data files
let billingPlansCache: BillingPlan[] | null = null;
let invoicesCache: Invoice[] | null = null;
let creditMemosCache: CreditMemo[] | null = null;
let exchangeRatesCache: ExchangeRate[] | null = null;

// ============================================
// READ-ONLY DATA FUNCTIONS (/data/ directory)
// ============================================

/**
 * Load all billing plans from data/billing_plans.json
 */
export function loadBillingPlans(): BillingPlan[] {
  if (!billingPlansCache) {
    const filePath = path.join(DATA_DIR, 'billing_plans.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    billingPlansCache = JSON.parse(data);
  }
  return billingPlansCache!;
}

/**
 * Load all invoices from data/invoices.json
 */
export function loadInvoices(): Invoice[] {
  if (!invoicesCache) {
    const filePath = path.join(DATA_DIR, 'invoices.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    invoicesCache = JSON.parse(data);
  }
  return invoicesCache!;
}

/**
 * Load all credit memos from data/credit_memos.json
 */
export function loadCreditMemos(): CreditMemo[] {
  if (!creditMemosCache) {
    const filePath = path.join(DATA_DIR, 'credit_memos.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    creditMemosCache = JSON.parse(data);
  }
  return creditMemosCache!;
}

/**
 * Load all exchange rates from data/exchange_rates.json
 */
export function loadExchangeRates(): ExchangeRate[] {
  if (!exchangeRatesCache) {
    const filePath = path.join(DATA_DIR, 'exchange_rates.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    exchangeRatesCache = JSON.parse(data);
  }
  return exchangeRatesCache!;
}

// Helper query functions for read-only data

/**
 * Get a billing plan by plan_id
 */
export function getPlanById(planId: string): BillingPlan | null {
  const plans = loadBillingPlans();
  return plans.find(p => p.plan_id === planId) || null;
}

/**
 * Get all invoices for a specific plan
 */
export function getInvoicesByPlanId(planId: string): Invoice[] {
  const invoices = loadInvoices();
  return invoices.filter(inv => inv.plan_id === planId);
}

/**
 * Get invoices by customer name
 */
export function getInvoicesByCustomer(customerName: string): Invoice[] {
  const invoices = loadInvoices();
  return invoices.filter(inv => inv.customer_name === customerName);
}

/**
 * Get credit memos for a specific invoice
 */
export function getCreditMemosByInvoiceId(invoiceId: string): CreditMemo[] {
  const memos = loadCreditMemos();
  return memos.filter(memo => memo.invoice_id === invoiceId);
}

/**
 * Get exchange rate for a specific currency pair and date
 */
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date: string
): number | null {
  const rates = loadExchangeRates();
  const rate = rates.find(r =>
    r.from_currency === fromCurrency &&
    r.to_currency === toCurrency &&
    r.date === date
  );
  return rate?.rate || null;
}

// ============================================
// SANDBOX DATA FUNCTIONS (/sandbox/ directory)
// ============================================

/**
 * Load all proposals from sandbox/proposals.json
 */
export function loadProposals(): Proposal[] {
  const filePath = path.join(SANDBOX_DIR, 'proposals.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Save proposals to sandbox/proposals.json
 */
export function saveProposals(proposals: Proposal[]): void {
  const filePath = path.join(SANDBOX_DIR, 'proposals.json');
  fs.writeFileSync(filePath, JSON.stringify(proposals, null, 2));
}

/**
 * Load all applied actions from sandbox/applied_actions.json
 */
export function loadAppliedActions(): AppliedAction[] {
  const filePath = path.join(SANDBOX_DIR, 'applied_actions.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Save applied actions to sandbox/applied_actions.json
 */
export function saveAppliedActions(actions: AppliedAction[]): void {
  const filePath = path.join(SANDBOX_DIR, 'applied_actions.json');
  fs.writeFileSync(filePath, JSON.stringify(actions, null, 2));
}

/**
 * Load audit log from sandbox/audit_log.json
 */
export function loadAuditLog(): AuditLog {
  const filePath = path.join(SANDBOX_DIR, 'audit_log.json');
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

/**
 * Append an entry to the audit log
 */
export function appendAuditLog(
  actionType: string,
  actionId: string,
  performedBy: string,
  details: Record<string, any>
): void {
  const log = loadAuditLog();
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action_type: actionType,
    action_id: actionId,
    performed_by: performedBy,
    details
  };
  log.entries.push(entry);
  
  const filePath = path.join(SANDBOX_DIR, 'audit_log.json');
  fs.writeFileSync(filePath, JSON.stringify(log, null, 2));
}

// ============================================
// HIGH-LEVEL PROPOSAL MANAGEMENT FUNCTIONS
// ============================================

/**
 * Create a new proposal and save it to sandbox
 */
export function createProposal(
  type: ProposalType,
  details: Proposal['details']
): string {
  const proposals = loadProposals();
  const id = `prop-${Date.now()}`;
  
  const proposal: Proposal = {
    id,
    type,
    status: 'pending',
    created_at: new Date().toISOString(),
    details
  };
  
  proposals.push(proposal);
  saveProposals(proposals);
  
  // Log the creation
  appendAuditLog('proposal_created', id, 'AI Agent', { type, details });
  
  return id;
}

/**
 * Apply a proposal (move it to applied_actions)
 */
export function applyProposal(proposalId: string, approver?: string): string {
  const proposals = loadProposals();
  const proposalIndex = proposals.findIndex(p => p.id === proposalId);
  
  if (proposalIndex === -1) {
    throw new Error('Proposal not found');
  }
  
  const proposal = proposals[proposalIndex];
  
  if (proposal.status !== 'pending') {
    throw new Error('Proposal is not pending');
  }
  
  // Update proposal status
  proposal.status = 'applied';
  saveProposals(proposals);
  
  // Add to applied actions
  const actions = loadAppliedActions();
  const appliedAction: AppliedAction = {
    ...proposal,
    applied_at: new Date().toISOString(),
    applied_by: approver
  };
  actions.push(appliedAction);
  saveAppliedActions(actions);
  
  // Log the application
  appendAuditLog('action_applied', proposalId, approver || 'user', { proposalId });
  
  return proposalId;
}

/**
 * Rollback an applied action
 */
export function rollbackAction(actionId: string, reason?: string): void {
  const actions = loadAppliedActions();
  const action = actions.find(a => a.id === actionId);
  
  if (!action) {
    throw new Error('Action not found');
  }
  
  // Mark as rolled back (adding a custom status)
  (action as any).status = 'rolled_back';
  (action as any).rolled_back_at = new Date().toISOString();
  (action as any).rollback_reason = reason;
  
  saveAppliedActions(actions);
  
  // Log the rollback
  appendAuditLog('action_rolled_back', actionId, 'user', { reason: reason || 'No reason provided' });
}

/**
 * Get a proposal by ID
 */
export function getProposalById(proposalId: string): Proposal | null {
  const proposals = loadProposals();
  return proposals.find(p => p.id === proposalId) || null;
}

/**
 * Clear cache (useful for testing or when data files are updated)
 */
export function clearCache(): void {
  billingPlansCache = null;
  invoicesCache = null;
  creditMemosCache = null;
  exchangeRatesCache = null;
}