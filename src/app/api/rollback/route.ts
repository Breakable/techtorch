import { NextRequest } from 'next/server';
import { rollbackAction } from '@/lib/dataService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rollback
 * 
 * Rollbacks an applied action.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId } = body;

    // Validate request body
    if (!actionId || typeof actionId !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing or invalid actionId parameter' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rollback the action
    rollbackAction(actionId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Action ${actionId} rolled back successfully`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Rollback API error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rollback action'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}