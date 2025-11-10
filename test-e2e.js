/**
 * End-to-End Test Script for Financial Dashboard
 * Tests the complete system including AI agent, API routes, and data services
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE_URL = 'http://localhost:3000';
const TEST_RESULTS = [];

// Helper function to log test results
function logTest(name, status, details = '') {
  const result = {
    test: name,
    status,
    details,
    timestamp: new Date().toISOString()
  };
  TEST_RESULTS.push(result);
  console.log(`[${status}] ${name}`);
  if (details) console.log(`    ${details}`);
}

// Test 1: Check if proposals endpoint returns data
async function testProposalsEndpoint() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/proposals`);
    const data = await response.json();
    
    if (response.ok && Array.isArray(data)) {
      logTest('GET /api/proposals', 'PASS', `Returns array with ${data.length} proposals`);
      return true;
    } else {
      logTest('GET /api/proposals', 'FAIL', 'Invalid response format');
      return false;
    }
  } catch (error) {
    logTest('GET /api/proposals', 'FAIL', error.message);
    return false;
  }
}

// Test 2: Test chat API with a simple message
async function testChatEndpoint() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello, can you help me?'
      })
    });

    if (response.ok) {
      // SSE response - just check it doesn't error
      logTest('POST /api/chat', 'PASS', 'Chat endpoint accepts messages');
      return true;
    } else {
      logTest('POST /api/chat', 'FAIL', `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logTest('POST /api/chat', 'FAIL', error.message);
    return false;
  }
}

// Test 3: Verify data files exist
function testDataFiles() {
  const dataFiles = [
    'data/billing_plans.json',
    'data/invoices.json',
    'data/exchange_rates.json',
    'data/credit_memos.json'
  ];

  let allExist = true;
  for (const file of dataFiles) {
    if (fs.existsSync(file)) {
      logTest(`Data File: ${file}`, 'PASS', 'File exists');
    } else {
      logTest(`Data File: ${file}`, 'FAIL', 'File not found');
      allExist = false;
    }
  }
  return allExist;
}

// Test 4: Verify sandbox files exist
function testSandboxFiles() {
  const sandboxFiles = [
    'sandbox/proposals.json',
    'sandbox/applied_actions.json',
    'sandbox/audit_log.json'
  ];

  let allExist = true;
  for (const file of sandboxFiles) {
    if (fs.existsSync(file)) {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      logTest(`Sandbox File: ${file}`, 'PASS', `Contains ${Array.isArray(content) ? content.length : 0} items`);
    } else {
      logTest(`Sandbox File: ${file}`, 'FAIL', 'File not found');
      allExist = false;
    }
  }
  return allExist;
}

// Test 5: Verify environment configuration
function testEnvironmentConfig() {
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasApiKey = envContent.includes('OPENROUTER_API_KEY') || 
                      envContent.includes('OPENAI_API_KEY') ||
                      envContent.includes('OPEN_ROUTER');
    
    if (hasApiKey) {
      logTest('Environment Config', 'PASS', 'API key configured');
      return true;
    } else {
      logTest('Environment Config', 'FAIL', 'No API key found');
      return false;
    }
  } else {
    logTest('Environment Config', 'FAIL', '.env file not found');
    return false;
  }
}

// Test 6: Check for ACME Corp anomaly in data
function testAcmeCorpData() {
  try {
    const invoices = JSON.parse(fs.readFileSync('data/invoices.json', 'utf8'));
    const acmeInvoices = invoices.filter(inv => inv.customer_name?.includes('ACME'));
    
    logTest('ACME Corp Data', 'PASS', `Found ${acmeInvoices.length} ACME Corp invoices`);
    
    // Check for expected months
    const months = acmeInvoices.map(inv => new Date(inv.issue_date).getMonth());
    const missingMonths = [];
    for (let m = 0; m < 12; m++) {
      if (!months.includes(m)) {
        missingMonths.push(m);
      }
    }
    
    if (missingMonths.length > 0) {
      logTest('ACME Corp Anomaly Detection', 'INFO', 
        `Missing months detected: ${missingMonths.map(m => m + 1).join(', ')} (This is the test anomaly)`);
    }
    
    return true;
  } catch (error) {
    logTest('ACME Corp Data', 'FAIL', error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n=== Financial Dashboard E2E Test Suite ===\n');
  console.log('Starting tests at:', new Date().toISOString());
  console.log('API Base URL:', API_BASE_URL);
  console.log('\n');

  // Run all tests
  testEnvironmentConfig();
  testDataFiles();
  testSandboxFiles();
  testAcmeCorpData();
  await testProposalsEndpoint();
  await testChatEndpoint();

  // Generate summary
  console.log('\n=== Test Summary ===\n');
  const passed = TEST_RESULTS.filter(t => t.status === 'PASS').length;
  const failed = TEST_RESULTS.filter(t => t.status === 'FAIL').length;
  const info = TEST_RESULTS.filter(t => t.status === 'INFO').length;
  
  console.log(`Total Tests: ${TEST_RESULTS.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Info: ${info}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  // Save results to file
  const reportPath = 'test-results.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total: TEST_RESULTS.length, passed, failed, info },
    results: TEST_RESULTS
  }, null, 2));
  
  console.log(`\nTest results saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});