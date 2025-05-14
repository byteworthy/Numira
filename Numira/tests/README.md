# Numira Test Suite

This directory contains the comprehensive test suite for the Numira backend. The tests are organized into different categories to ensure thorough coverage of the application's functionality.

## Test Structure

The test suite is organized as follows:

```
tests/
├── unit/                      # Unit tests
│   ├── controllers/           # Controller tests
│   ├── middleware/            # Middleware tests
│   ├── services/              # Service tests
│   └── utils/                 # Utility tests
├── integration/               # Integration tests
│   ├── api/                   # API endpoint tests
│   ├── database/              # Database operation tests
│   └── user-flows/            # User journey tests
├── failover/                  # Failover and resilience tests
├── performance/               # Performance tests
├── setup.js                   # Test setup file
├── global-setup.js            # Global setup file
├── global-teardown.js         # Global teardown file
└── test-helpers.js            # Helper functions for tests
```

## Running Tests

The test suite can be run using the following npm scripts:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run API tests only
npm run test:api

# Run user flow tests only
npm run test:userflows

# Run failover tests only
npm run test:failover

# Run performance tests only
npm run test:performance

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

You can also run specific test files using the run-tests.js script directly:

```bash
node scripts/run-tests.js <test-pattern>
```

For example:

```bash
# Run a specific test file
node scripts/run-tests.js tests/unit/services/authService.test.js

# Run all tests in a specific directory
node scripts/run-tests.js tests/unit/middleware/
```

## Test Environment

The test environment is set up using the following files:

- `setup.js`: Runs before each test file and sets up the test environment
- `global-setup.js`: Runs once before all tests and sets up the global test environment
- `global-teardown.js`: Runs once after all tests and cleans up the global test environment
- `test-helpers.js`: Contains helper functions for tests

The test environment uses the following:

- Jest as the test runner
- Chai for assertions
- Sinon for mocking and stubbing
- Supertest for API testing
- Mock-fs for file system mocking
- Prisma Client for database interactions

## Writing Tests

### Unit Tests

Unit tests should test individual functions or methods in isolation. They should mock all external dependencies.

Example:

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const { PrismaClient } = require('@prisma/client');
const authService = require('../../../services/authService');

describe('Auth Service', () => {
  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      // Setup
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User'
      };
      
      // Mock dependencies
      const prisma = new PrismaClient();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: userData.email,
        name: userData.name,
        role: 'user',
        status: 'active'
      });
      
      // Execute
      const result = await authService.registerUser(userData);
      
      // Assert
      expect(result).to.have.property('id', 'user-123');
      expect(result).to.have.property('email', userData.email);
    });
  });
});
```

### Integration Tests

Integration tests should test the interaction between multiple components. They should use the actual dependencies when possible.

Example:

```javascript
const request = require('supertest');
const app = require('../../../server');
const { PrismaClient } = require('@prisma/client');
const { createTestUser, cleanupTestData } = require('../../test-helpers');

describe('Auth API', () => {
  const testEntities = {
    userIds: []
  };
  
  afterAll(async () => {
    await cleanupTestData({
      userIds: testEntities.userIds
    });
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body.data.user).toHaveProperty('email', userData.email);
      
      testEntities.userIds.push(response.body.data.user.id);
    });
  });
});
```

### User Flow Tests

User flow tests should test complete user journeys through the application. They should simulate user interactions and verify the expected outcomes.

Example:

```javascript
const request = require('supertest');
const app = require('../../../server');
const { cleanupTestData } = require('../../test-helpers');

describe('User Registration and Conversation Flow', () => {
  const testEntities = {
    userIds: [],
    conversationIds: [],
    messageIds: []
  };
  
  afterAll(async () => {
    await cleanupTestData({
      messageIds: testEntities.messageIds,
      conversationIds: testEntities.conversationIds,
      userIds: testEntities.userIds
    });
  });
  
  it('should allow a user to register, login, and have a conversation', async () => {
    // Step 1: Register a new user
    const userData = {
      email: `test-flow-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test Flow User'
    };
    
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);
    
    expect(registerResponse.status).toBe(201);
    
    // Step 2: Login with the new user
    // ... and so on
  });
});
```

## Test Helpers

The `test-helpers.js` file contains utility functions to help with testing. These include:

- `generateTestToken`: Generate a JWT token for testing
- `createTestUser`: Create a test user in the database
- `createTestAdmin`: Create a test admin user in the database
- `loginTestUser`: Login a test user and get auth token
- `createTestPersona`: Create a test persona in the database
- `createTestRoom`: Create a test room in the database
- `createTestConversation`: Create a test conversation in the database
- `createTestMessages`: Create test messages for a conversation
- `createTestJournal`: Create a test journal entry in the database
- `createTestInsight`: Create a test insight in the database
- `cleanupTestData`: Clean up test data after tests
- `createAuthenticatedClient`: Create a test API client with authentication
- `wait`: Wait for a specified amount of time

## Best Practices

1. **Isolation**: Each test should be isolated from other tests. Use the `cleanupTestData` function to clean up after tests.

2. **Mocking**: Mock external dependencies in unit tests. Use the mocks provided in `setup.js` or create your own.

3. **Test Structure**: Follow the AAA pattern (Arrange, Act, Assert) for test structure:
   - Arrange: Set up the test data and environment
   - Act: Execute the code being tested
   - Assert: Verify the results

4. **Test Coverage**: Aim for high test coverage, especially for critical paths. Use `npm run test:coverage` to check coverage.

5. **Test Naming**: Use descriptive test names that explain what is being tested and what the expected outcome is.

6. **Test Organization**: Organize tests by feature or component. Use nested `describe` blocks to group related tests.

7. **Test Data**: Use unique test data for each test to avoid conflicts. Use the `Date.now()` function to generate unique identifiers.

8. **Error Handling**: Test both success and error cases. Ensure that error handling is properly tested.

9. **Performance**: Keep tests fast. Avoid unnecessary database operations or network requests.

10. **Maintainability**: Keep tests simple and easy to understand. Avoid complex test setups or assertions.

## Continuous Integration

The test suite is integrated with the CI/CD pipeline. Tests are run automatically on every pull request and before deployment.

The CI pipeline runs the following commands:

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Run tests with coverage
npm run test:coverage
```

## Troubleshooting

If you encounter issues with the test suite, try the following:

1. **Clean up test data**: Run `npm run setup:test` to reset the test environment.

2. **Check environment variables**: Ensure that the `.env.test` file is properly configured.

3. **Check database connection**: Ensure that the test database is running and accessible.

4. **Check mocks**: Ensure that mocks are properly configured in `setup.js`.

5. **Run tests in verbose mode**: Use `npm run test:verbose` to get more detailed output.

6. **Run specific tests**: Use `node scripts/run-tests.js <test-pattern>` to run specific tests.

7. **Check for race conditions**: If tests are failing intermittently, check for race conditions or timing issues.

8. **Check for memory leaks**: If tests are running out of memory, check for memory leaks or resource leaks.

9. **Check for test dependencies**: Ensure that tests are not dependent on each other.

10. **Check for test order**: Ensure that tests are not dependent on the order in which they are run.
