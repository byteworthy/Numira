#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * This script provides a convenient way to run tests with specific patterns.
 * It supports running unit tests, integration tests, or specific test files.
 * 
 * Usage:
 *   node scripts/run-tests.js [options] [test-pattern]
 * 
 * Options:
 *   --unit           Run unit tests only
 *   --integration    Run integration tests only
 *   --api            Run API tests only
 *   --userflows      Run user flow tests only
 *   --failover       Run failover tests only
 *   --performance    Run performance tests only
 *   --watch          Run tests in watch mode
 *   --coverage       Run tests with coverage report
 *   --verbose        Run tests with verbose output
 *   --help           Show help
 * 
 * Examples:
 *   node scripts/run-tests.js                                  # Run all tests
 *   node scripts/run-tests.js --unit                           # Run all unit tests
 *   node scripts/run-tests.js --integration                    # Run all integration tests
 *   node scripts/run-tests.js tests/unit/services              # Run all service unit tests
 *   node scripts/run-tests.js tests/unit/services/authService  # Run auth service tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  unit: args.includes('--unit'),
  integration: args.includes('--integration'),
  api: args.includes('--api'),
  userflows: args.includes('--userflows'),
  failover: args.includes('--failover'),
  performance: args.includes('--performance'),
  watch: args.includes('--watch'),
  coverage: args.includes('--coverage'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help')
};

// Remove option flags from args
const testPattern = args.filter(arg => !arg.startsWith('--'));

// Show help if requested
if (options.help) {
  console.log(`
Test Runner Script

This script provides a convenient way to run tests with specific patterns.
It supports running unit tests, integration tests, or specific test files.

Usage:
  node scripts/run-tests.js [options] [test-pattern]

Options:
  --unit           Run unit tests only
  --integration    Run integration tests only
  --api            Run API tests only
  --userflows      Run user flow tests only
  --failover       Run failover tests only
  --performance    Run performance tests only
  --watch          Run tests in watch mode
  --coverage       Run tests with coverage report
  --verbose        Run tests with verbose output
  --help           Show help

Examples:
  node scripts/run-tests.js                                  # Run all tests
  node scripts/run-tests.js --unit                           # Run all unit tests
  node scripts/run-tests.js --integration                    # Run all integration tests
  node scripts/run-tests.js tests/unit/services              # Run all service unit tests
  node scripts/run-tests.js tests/unit/services/authService  # Run auth service tests
  `);
  process.exit(0);
}

// Build Jest command
let jestCommand = 'jest';
let jestArgs = [];

// Add test pattern
if (testPattern.length > 0) {
  jestArgs.push(testPattern.join(' '));
}

// Add options
if (options.unit) {
  jestArgs.push('tests/unit');
}

if (options.integration) {
  jestArgs.push('tests/integration');
}

if (options.api) {
  jestArgs.push('tests/integration/api');
}

if (options.userflows) {
  jestArgs.push('tests/integration/user-flows');
}

if (options.failover) {
  jestArgs.push('tests/integration/failover');
}

if (options.performance) {
  jestArgs.push('tests/performance');
}

if (options.watch) {
  jestArgs.push('--watch');
}

if (options.coverage) {
  jestArgs.push('--coverage');
}

if (options.verbose) {
  jestArgs.push('--verbose');
}

// Check if we're using npm or yarn
const packageJsonPath = path.join(process.cwd(), 'package.json');
let useYarn = false;

if (fs.existsSync(packageJsonPath)) {
  const packageJson = require(packageJsonPath);
  
  // Check if yarn.lock exists
  const yarnLockPath = path.join(process.cwd(), 'yarn.lock');
  useYarn = fs.existsSync(yarnLockPath);
  
  // Use the test script from package.json if no specific options are provided
  if (Object.keys(options).every(option => !options[option]) && testPattern.length === 0) {
    if (packageJson.scripts && packageJson.scripts.test) {
      const command = useYarn ? 'yarn' : 'npm';
      const args = useYarn ? ['test'] : ['run', 'test'];
      
      console.log(`Running: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, { stdio: 'inherit', shell: true });
      
      child.on('close', code => {
        process.exit(code);
      });
      
      return;
    }
  }
}

// Build the final command
const command = useYarn ? 'yarn' : 'npx';
const commandArgs = useYarn ? ['jest', ...jestArgs] : [jestCommand, ...jestArgs];

console.log(`Running: ${command} ${commandArgs.join(' ')}`);

// Run the command
const child = spawn(command, commandArgs, { stdio: 'inherit', shell: true });

child.on('close', code => {
  process.exit(code);
});
