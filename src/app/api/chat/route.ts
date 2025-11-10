import { NextRequest } from 'next/server';
import { streamAgent } from '@/lib/agentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat
 * 
 * Handles chat messages with Server-Sent Events (SSE) streaming.
 * Streams the AI agent's response token-by-token.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    // Validate request body
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid message parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream agent response token-by-token
          for await (const token of streamAgent(message)) {
            // Check if controller is still active before enqueueing
            try {
              const data = JSON.stringify({ type: 'token', content: token });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch (enqueueError) {
              // Controller closed, break the loop
              console.error('Controller closed during streaming:', enqueueError);
              break;
            }
          }

          // Send completion event if controller is still open
          try {
            const doneData = JSON.stringify({ type: 'done' });
            controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          } catch (enqueueError) {
            console.error('Could not send done event:', enqueueError);
          }
        } catch (error) {
          console.error('Agent streaming error:', error);
          
          // Send error event if controller is still open
          try {
            const errorData = JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'An unknown error occurred'
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          } catch (enqueueError) {
            console.error('Could not send error event:', enqueueError);
          }
        } finally {
          // Close controller if not already closed
          try {
            controller.close();
          } catch (closeError) {
            // Already closed, ignore
          }
        }
      }
    });

    // Return SSE response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}