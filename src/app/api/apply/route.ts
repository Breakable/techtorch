import { NextRequest } from 'next/server';
import { applyProposal } from '@/lib/dataService';
import type { AppliedAction } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/apply
 * 
 * Applies a proposal by moving it to applied_actions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposalId } = body;

    // Validate request body
    if (!proposalId || typeof proposalId !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing or invalid proposalId parameter' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Apply the proposal
    const actionId = applyProposal(proposalId);

    // Get the applied action to return
    const { loadAppliedActions } = await import('@/lib/dataService');
    const actions = loadAppliedActions();
    const action = actions.find(a => a.id === proposalId) as AppliedAction | undefined;

    return new Response(
      JSON.stringify({
        success: true,
        action,
        message: 'Proposal applied successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Apply API error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply proposal'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}