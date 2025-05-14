/**
 * Jest Configuration
 * 
 * This file configures Jest for running tests in the Numira project.
 */

module.exports = {
  // The root directory that Jest should scan for tests and modules
  rootDir: '.',
  
  // The test environment that will be used for testing
  testEnvironment: 'node',
  
  // The glob patterns Jest uses to detect test files
  testMatch: [
    '**/tests/**/*.test.js',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  
  // An array of regexp pattern strings that are matched against all test paths
  // matched tests are skipped
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // An array of regexp pattern strings that are matched against all source file paths
  // matched files will have coverage information generated
  collectCoverageFrom: [
    'services/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    'promptEngine/**/*.js',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  
  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'html'],
  
  // The minimum threshold enforcement for coverage results
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './middleware/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './utils/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // A set of global variables that need to be available in all test environments
  globals: {
    NODE_ENV: 'test'
  },
  
  // A path to a module which exports an async function that is triggered once before all test suites
  globalSetup: './tests/global-setup.js',
  
  // A path to a module which exports an async function that is triggered once after all test suites
  globalTeardown: './tests/global-teardown.js',
  
  // A path to a module which exports a function that is triggered once before each test file
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // The maximum amount of workers used to run your tests (defaults to number of CPUs - 1)
  maxWorkers: '50%',
  
  // An array of directory names to be searched recursively up from the requiring module's location
  moduleDirectories: ['node_modules'],
  
  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'json', 'node'],
  
  // A map from regular expressions to module names that allow to stub out resources
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Activates notifications for test results
  notify: false,
  
  // Run tests with specified reporters
  reporters: ['default'],
  
  // The paths to modules that run some code to configure or set up the testing environment
  setupFiles: [],
  
  // The test runner to use
  testRunner: 'jest-circus/runner',
  
  // Setting this value to "fake" allows the use of fake timers for functions such as setTimeout
  timers: 'real',
  
  // A map from regular expressions to paths to transformers
  transform: {},
  
  // An array of regexp pattern strings that are matched against all modules before they are loaded
  transformIgnorePatterns: ['/node_modules/'],
  
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  
  // Whether to use watchman for file crawling
  watchman: true,
  
  // Default timeout of a test in milliseconds
  testTimeout: 30000
};
