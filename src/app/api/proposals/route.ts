import { NextRequest } from 'next/server';
import { loadProposals } from '@/lib/dataService';
import type { Proposal } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/proposals
 * 
 * Fetches all current proposals from the sandbox.
 */
export async function GET(req: NextRequest) {
  try {
    // Load all proposals from sandbox
    const proposals: Proposal[] = loadProposals();

    return new Response(
      JSON.stringify({
        proposals
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Proposals API error:', error);
    
    return new Response(
      JSON.stringify({
        proposals: [],
        error: error instanceof Error ? error.message : 'Failed to load proposals'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}