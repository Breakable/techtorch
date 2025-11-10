/**
 * Debug script to test agent SSE streaming
 * Run with: node debug-agent.js
 * 
 * This script makes a POST request to /api/chat and captures the complete SSE stream
 * to identify where the agent stops executing.
 */

const http = require('http');

console.log('🔍 Debug Agent SSE Stream\n');
console.log('='.repeat(60));
console.log('Testing: Investigate ACME Corp billing for missing invoices');
console.log('='.repeat(60) + '\n');

const postData = JSON.stringify({
  message: 'Investigate ACME Corp billing for missing invoices'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

let tokenCount = 0;
let toolCallCount = 0;
let proposalCount = 0;
let fullResponse = '';
let eventCount = 0;
let errors = [];

console.log('📡 Starting SSE stream...\n');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}\n`);
  
  res.setEncoding('utf8');
  
  res.on('data', (chunk) => {
    eventCount++;
    
    // Parse SSE events
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6);
        
        try {
          const parsed = JSON.parse(data);
          
          if (parsed.type === 'token') {
            tokenCount++;
            fullResponse += parsed.content;
            
            // Log tokens in real-time
            process.stdout.write(parsed.content);
            
            // Track tool calls
            if (parsed.content.includes('🔧 Using tool:')) {
              toolCallCount++;
              console.log(`\n[DEBUG] Tool call #${toolCallCount} detected`);
            }
            
            // Track proposals
            if (parsed.content.includes('propose_make_good_invoice') || 
                parsed.content.includes('propose_credit_memo') ||
                parsed.content.includes('propose_plan_amendment')) {
              proposalCount++;
              console.log(`\n[DEBUG] Proposal #${proposalCount} created`);
            }
            
          } else if (parsed.type === 'done') {
            console.log('\n\n✅ Stream completed (done event received)');
          } else if (parsed.type === 'error') {
            errors.push(parsed.message);
            console.log(`\n\n❌ Error event: ${parsed.message}`);
          }
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }
  });
  
  res.on('end', () => {
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 STREAM SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total events received: ${eventCount}`);
    console.log(`Total tokens streamed: ${tokenCount}`);
    console.log(`Tool calls made: ${toolCallCount}`);
    console.log(`Proposals created: ${proposalCount}`);
    console.log(`Errors encountered: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
    
    console.log('\n📝 Full Response Length: ' + fullResponse.length + ' characters');
    
    // Analysis
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ANALYSIS');
    console.log('='.repeat(60));
    
    if (toolCallCount === 0) {
      console.log('⚠️  NO TOOL CALLS - Agent did not use any tools');
    } else if (toolCallCount === 1) {
      console.log('⚠️  ONLY 1 TOOL CALL - Agent stopped after first tool');
      console.log('    Expected: Multiple tool calls (load_plan, query_invoices, propose_make_good_invoice)');
    } else {
      console.log(`✅ ${toolCallCount} tool calls made`);
    }
    
    if (proposalCount === 0) {
      console.log('❌ NO PROPOSALS CREATED - Agent did not create any proposals');
      console.log('    Expected: At least 3 proposals for missing invoices');
    } else {
      console.log(`✅ ${proposalCount} proposals created`);
    }
    
    if (fullResponse.includes('September') && 
        fullResponse.includes('November') && 
        fullResponse.includes('December')) {
      console.log('✅ Missing months identified (Sept, Nov, Dec)');
    } else {
      console.log('⚠️  Missing months not identified in response');
    }
    
    if (fullResponse.length < 500) {
      console.log('⚠️  Response seems truncated (< 500 chars)');
    }
    
    console.log('\n' + '='.repeat(60));
    
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`\n❌ Request error: ${e.message}`);
  process.exit(1);
});

// Set timeout
setTimeout(() => {
  console.log('\n\n⏱️  Timeout reached (30s) - ending stream capture');
  req.destroy();
  process.exit(1);
}, 30000);

req.write(postData);
req.end();