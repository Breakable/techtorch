// Simple test to verify data service can read files
const fs = require('fs');
const path = require('path');

console.log('Testing project setup...\n');

// Test 1: Check data files exist
const dataFiles = ['billing_plans.json', 'invoices.json', 'credit_memos.json', 'exchange_rates.json'];
console.log('1. Checking data files:');
dataFiles.forEach(file => {
  const filePath = path.join(process.cwd(), 'data', file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✓' : '✗'} ${file}`);
  if (exists) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`     - Contains ${Array.isArray(data) ? data.length : 'N/A'} records`);
  }
});

// Test 2: Check sandbox files exist
console.log('\n2. Checking sandbox files:');
const sandboxFiles = ['proposals.json', 'applied_actions.json', 'audit_log.json'];
sandboxFiles.forEach(file => {
  const filePath = path.join(process.cwd(), 'sandbox', file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✓' : '✗'} ${file}`);
  if (exists) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`     - Initialized: ${JSON.stringify(data)}`);
  }
});

// Test 3: Check .env file
console.log('\n3. Checking .env configuration:');
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hasOpenRouter = envContent.includes('OPEN_ROUTER=');
  console.log(`   ${hasOpenRouter ? '✓' : '✗'} OPEN_ROUTER key configured`);
} else {
  console.log('   ✗ .env file not found');
}

// Test 4: Check TypeScript configuration
console.log('\n4. Checking TypeScript setup:');
const tsConfigPath = path.join(process.cwd(), 'tsconfig.json');
const tsconfigExists = fs.existsSync(tsConfigPath);
console.log(`   ${tsconfigExists ? '✓' : '✗'} tsconfig.json exists`);

// Test 5: Check Next.js configuration
console.log('\n5. Checking Next.js setup:');
const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
const nextConfigExists = fs.existsSync(nextConfigPath);
console.log(`   ${nextConfigExists ? '✓' : '✗'} next.config.ts exists`);

// Test 6: Check source structure
console.log('\n6. Checking source structure:');
const srcDirs = ['src/app', 'src/app/api/chat', 'src/app/api/apply', 'src/app/api/rollback', 'src/components', 'src/lib', 'src/types'];
srcDirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  const exists = fs.existsSync(dirPath);
  console.log(`   ${exists ? '✓' : '✗'} ${dir}`);
});

console.log('\n✅ Project setup verification complete!\n');