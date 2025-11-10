import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  getPlanById,
  loadInvoices,
  getExchangeRate,
  createProposal,
} from "./dataService";

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are a financial detective AI agent specializing in revenue leakage detection and billing reconciliation.

## Your Role
You autonomously investigate billing anomalies by:
1. Analyzing billing plans and invoices
2. Identifying discrepancies (missing invoices, overbilling, underbilling, orphans, amendment tracking issues)
3. Proposing corrective actions with clear evidence and reasoning

## Available Tools
You have access to 6 tools:
- load_plan: Get billing plan details by plan_id
- query_invoices: Filter invoices by plan_id, customer_name, or date range
- fx_convert: Perform currency conversions with historical exchange rates
- propose_make_good_invoice: Draft a recovery invoice for missing/underbilled revenue (requires approval)
- propose_credit_memo: Draft a credit for overbilling (requires approval)
- propose_plan_amendment: Draft a plan update (requires approval)

## Investigation Principles
1. **Evidence-based:** Always cite specific data (invoice IDs, amounts, dates)
2. **Multi-step reasoning:** Break down complex problems step by step
3. **Currency-aware:** Use fx_convert when comparing cross-currency amounts
4. **Amendment-tracking:** Check for plan amendments (e.g., C-1007 → C-1007-A1)
5. **Clear explanations:** Justify every proposal with calculations and evidence

## Anomaly Types to Detect
1. **Missing invoices:** Expected monthly/quarterly invoice not found based on billing cadence
2. **Overbilling:** Invoice amount exceeds expected amount (check FX rates for currency mismatches!)
3. **Underbilling:** Invoice amount less than expected amount
4. **Orphan invoices:** Invoice with no plan_id or invalid plan reference
5. **Amendment issues:** Invoices billed against superseded plans

## Response Format
When you detect an anomaly:
1. State the finding clearly with specific evidence
2. Show your calculations and reasoning
3. Cite exact invoice IDs, amounts, and dates
4. Propose a corrective action if appropriate
5. Explain why this action fixes the issue

## Important Constraints
- You CANNOT directly apply actions (no database writes)
- All proposals require human approval via the "Apply" button
- Work with data in /data/ directory (read-only)
- All proposals are written to /sandbox/ for review
- Always think step-by-step and show your reasoning

Think carefully and cite evidence for every conclusion.`;

// ============================================
// TOOL DEFINITIONS
// ============================================

/**
 * Tool 1: Load billing plan by plan_id
 */
const loadPlanTool = new DynamicStructuredTool({
  name: "load_plan",
  description: "Retrieve billing plan details by plan ID. Use this to understand contract terms, total value, billing cadence, start date, and entitlements. Essential for comparing expected vs actual invoices.",
  schema: z.object({
    plan_id: z.string().describe("The billing plan ID (e.g., 'C-1001', 'C-1007-A1')"),
  }),
  func: async ({ plan_id }) => {
    try {
      const plan = getPlanById(plan_id);
      
      if (!plan) {
        return JSON.stringify({
          error: `Plan ${plan_id} not found`,
          suggestion: "Verify the plan_id is correct or check if this is an orphan invoice"
        });
      }
      
      return JSON.stringify({
        plan_id: plan.plan_id,
        customer_name: plan.customer_name,
        total_value: plan.total_value,
        currency: plan.currency,
        cadence: plan.cadence,
        start_date: plan.start_date,
        entitlements: plan.entitlements,
        notes: plan.notes,
        amends: plan.amends,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: `Failed to load plan: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },
});

/**
 * Tool 2: Query invoices with filters
 */
const queryInvoicesTool = new DynamicStructuredTool({
  name: "query_invoices",
  description: "Filter invoices by plan_id, customer_name, or date range. Returns matching invoices with full details including amounts, dates, and status. Use this to find all invoices for a plan or customer.",
  schema: z.object({
    plan_id: z.string().optional().describe("Filter by billing plan ID"),
    customer_name: z.string().optional().describe("Filter by customer name"),
    date_from: z.string().optional().describe("Start date in ISO format (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("End date in ISO format (YYYY-MM-DD)"),
  }),
  func: async (filters) => {
    try {
      let invoices = loadInvoices();
      
      // Apply filters
      if (filters.plan_id) {
        invoices = invoices.filter(inv => inv.plan_id === filters.plan_id);
      }
      if (filters.customer_name) {
        invoices = invoices.filter(inv => 
          inv.customer_name.toLowerCase().includes(filters.customer_name!.toLowerCase())
        );
      }
      if (filters.date_from) {
        const fromDate = new Date(filters.date_from);
        invoices = invoices.filter(inv => new Date(inv.issue_date) >= fromDate);
      }
      if (filters.date_to) {
        const toDate = new Date(filters.date_to);
        invoices = invoices.filter(inv => new Date(inv.issue_date) <= toDate);
      }
      
      return JSON.stringify({
        count: invoices.length,
        filters_applied: filters,
        invoices: invoices.map(inv => ({
          invoice_id: inv.invoice_id,
          plan_id: inv.plan_id,
          customer_name: inv.customer_name,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          amount_invoiced: inv.amount_invoiced,
          currency: inv.currency,
          status: inv.status,
          description: inv.description,
        })),
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: `Failed to query invoices: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },
});

/**
 * Tool 3: FX conversion with historical rates
 */
const fxConvertTool = new DynamicStructuredTool({
  name: "fx_convert",
  description: "Convert an amount from one currency to another using historical exchange rates for a specific date. Critical for detecting overbilling due to incorrect FX rates. Use the issue_date from invoices for accurate conversion.",
  schema: z.object({
    amount: z.number().describe("Amount to convert"),
    from_currency: z.string().describe("Source currency code (e.g., 'EUR', 'USD')"),
    to_currency: z.string().describe("Target currency code (e.g., 'EUR', 'USD')"),
    date: z.string().describe("Date for exchange rate in ISO format (YYYY-MM-DD)"),
  }),
  func: async ({ amount, from_currency, to_currency, date }) => {
    try {
      // Same currency - no conversion needed
      if (from_currency === to_currency) {
        return JSON.stringify({
          original_amount: amount,
          from_currency,
          converted_amount: amount,
          to_currency,
          rate: 1.0,
          date,
          note: "Same currency - no conversion required"
        });
      }
      
      const rate = getExchangeRate(from_currency, to_currency, date);
      
      if (!rate) {
        return JSON.stringify({
          error: `No FX rate found for ${from_currency}→${to_currency} on ${date}`,
          suggestion: "Check if the date is correct or if the currency pair is supported in exchange_rates.json"
        });
      }
      
      const converted = amount * rate;
      
      return JSON.stringify({
        original_amount: amount,
        from_currency,
        converted_amount: Math.round(converted * 100) / 100, // Round to 2 decimals
        to_currency,
        rate,
        date,
        calculation: `${amount} ${from_currency} × ${rate} = ${converted.toFixed(2)} ${to_currency}`
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to convert currency: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },
});

/**
 * Tool 4: Propose make-good invoice (for missing/underbilled revenue)
 */
const proposeMakeGoodInvoiceTool = new DynamicStructuredTool({
  name: "propose_make_good_invoice",
  description: "Create a proposal for a make-good invoice to recover missing or underbilled revenue. This does NOT apply the invoice immediately - it creates a proposal for human approval. Always provide clear reasoning with evidence (invoice IDs, dates, calculations).",
  schema: z.object({
    plan_id: z.string().describe("The billing plan ID this invoice relates to"),
    amount: z.number().describe("Amount to invoice"),
    currency: z.string().describe("Currency code (e.g., 'USD', 'EUR')"),
    reason: z.string().describe("Clear explanation with evidence: what was missing, why, and how you calculated this amount"),
  }),
  func: async (params) => {
    try {
      const proposalId = createProposal("make_good_invoice", {
        plan_id: params.plan_id,
        amount: params.amount,
        currency: params.currency,
        reason: params.reason,
        proposed_at: new Date().toISOString(),
      });
      
      return JSON.stringify({
        success: true,
        proposal_id: proposalId,
        type: "make_good_invoice",
        status: "pending_approval",
        message: "Make-good invoice proposal created successfully. Awaiting human approval.",
        details: params,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to create make-good proposal: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },
});

/**
 * Tool 5: Propose credit memo (for overbilling correction)
 */
const proposeCreditMemoTool = new DynamicStructuredTool({
  name: "propose_credit_memo",
  description: "Create a proposal for a credit memo to correct overbilling. This does NOT apply the credit immediately - it creates a proposal for human approval. Use when an invoice amount exceeds what should have been billed (e.g., FX errors, duplicate billing).",
  schema: z.object({
    invoice_id: z.string().describe("The invoice ID that needs correction"),
    amount: z.number().describe("Credit amount (positive number)"),
    currency: z.string().describe("Currency code (e.g., 'USD', 'EUR')"),
    reason: z.string().describe("Clear explanation with evidence: what was overbilled, why, and how you calculated the credit amount"),
  }),
  func: async (params) => {
    try {
      const proposalId = createProposal("credit_memo", {
        invoice_id: params.invoice_id,
        amount: params.amount,
        currency: params.currency,
        reason: params.reason,
        proposed_at: new Date().toISOString(),
      });
      
      return JSON.stringify({
        success: true,
        proposal_id: proposalId,
        type: "credit_memo",
        status: "pending_approval",
        message: "Credit memo proposal created successfully. Awaiting human approval.",
        details: params,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to create credit memo proposal: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },
});

/**
 * Tool 6: Propose plan amendment (for billing plan updates)
 */
const proposePlanAmendmentTool = new DynamicStructuredTool({
  name: "propose_plan_amendment",
  description: "Create a proposal to amend a billing plan (update total value, cadence, or entitlements). This does NOT apply the amendment immediately - it creates a proposal for human approval. Use when the contract terms themselves need to change.",
  schema: z.object({
    plan_id: z.string().describe("The billing plan ID to amend"),
    changes: z.object({
      total_value: z.number().optional().describe("New total contract value"),
      cadence: z.string().optional().describe("New billing cadence (e.g., 'monthly', 'quarterly', 'annual')"),
      entitlements: z.array(z.string()).optional().describe("New list of entitlements/services"),
    }).describe("Changes to apply to the plan"),
    reason: z.string().describe("Clear explanation with evidence: why this amendment is needed"),
  }),
  func: async (params) => {
    try {
      const proposalId = createProposal("plan_amendment", {
        plan_id: params.plan_id,
        changes: params.changes,
        reason: params.reason,
        proposed_at: new Date().toISOString(),
      });
      
      return JSON.stringify({
        success: true,
        proposal_id: proposalId,
        type: "plan_amendment",
        status: "pending_approval",
        message: "Plan amendment proposal created successfully. Awaiting human approval.",
        details: params,
      });
    } catch (error) {
      return JSON.stringify({
        error: `Failed to create plan amendment proposal: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },
});

// Collect all tools
const tools = [
  loadPlanTool,
  queryInvoicesTool,
  fxConvertTool,
  proposeMakeGoodInvoiceTool,
  proposeCreditMemoTool,
  proposePlanAmendmentTool,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Execute a tool by name
 */
async function executeTool(toolName: string, toolInput: any): Promise<string> {
  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    return JSON.stringify({ error: `Tool ${toolName} not found` });
  }
  return await tool.func(toolInput);
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface AgentResponse {
  output: string;
  intermediateSteps?: Array<{
    action: string;
    observation: string;
  }>;
}

// ============================================
// EXPORTED FUNCTIONS
// ============================================

/**
 * Run the agent with a user message and return complete response
 */
export async function runAgent(userMessage: string): Promise<AgentResponse> {
  try {
    const llm = new ChatOpenAI({
      modelName: "openai/gpt-4o",
      openAIApiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER,
      temperature: 0,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    }).bindTools(tools);

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ];

    let finalOutput = "";
    const intermediateSteps: Array<{ action: string; observation: string }> = [];
    let iterations = 0;
    const maxIterations = 15;

    while (iterations < maxIterations) {
      iterations++;

      const response = await llm.invoke(messages);
      const toolCalls = (response as any).tool_calls || [];

      if (toolCalls.length === 0) {
        finalOutput = response.content as string;
        break;
      }

      messages.push(new AIMessage({
        content: response.content,
        additional_kwargs: { tool_calls: toolCalls }
      }));

      for (const toolCall of toolCalls) {
        const observation = await executeTool(toolCall.name, toolCall.args);
        intermediateSteps.push({
          action: toolCall.name,
          observation,
        });

        messages.push(new ToolMessage({
          content: observation,
          tool_call_id: toolCall.id,
        }));
      }
    }

    return {
      output: finalOutput,
      intermediateSteps,
    };
  } catch (error) {
    console.error("Agent execution error:", error);
    throw new Error(`Agent failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stream the agent execution token by token (for SSE)
 */
export async function* streamAgent(userMessage: string): AsyncIterable<string> {
  try {
    // Use non-streaming LLM for tool calls to avoid partial tool call chunks
    const llm = new ChatOpenAI({
      modelName: "openai/gpt-4o",
      openAIApiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER,
      temperature: 0,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    }).bindTools(tools);
    
    // Create streaming LLM for final text response
    const streamingLlm = new ChatOpenAI({
      modelName: "openai/gpt-4o",
      openAIApiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER,
      temperature: 0,
      streaming: true,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    }).bindTools(tools);

    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userMessage),
    ];

    let iterations = 0;
    const maxIterations = 15;

    while (iterations < maxIterations) {
      iterations++;

      // Use non-streaming call to get complete tool calls
      const response = await llm.invoke(messages);
      const toolCalls = (response as any).tool_calls || [];

      // If there are no tool calls, stream the final response
      if (toolCalls.length === 0) {
        // Stream the final text response
        const stream = await streamingLlm.stream(messages);
        for await (const chunk of stream) {
          if (chunk.content) {
            yield chunk.content as string;
          }
        }
        break;
      }

      // Yield the thinking text before tool calls
      if (response.content) {
        yield response.content as string;
      }

      messages.push(new AIMessage({
        content: response.content as string || "",
        tool_calls: toolCalls.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        })),
      }));

      // Execute each tool call
      for (const toolCall of toolCalls) {
        yield `\n\n🔧 Using tool: ${toolCall.name}\n`;
        const observation = await executeTool(toolCall.name, toolCall.args);
        yield `📊 Result: ${observation}\n\n`;

        messages.push(new ToolMessage({
          content: observation,
          tool_call_id: toolCall.id,
        }));
      }
    }
  } catch (error) {
    console.error("Agent streaming error:", error);
    yield `\n\nError: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Export the system prompt for documentation
 */
export { SYSTEM_PROMPT };