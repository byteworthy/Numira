const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const logger = require('../utils/logger');

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Numira API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Numira mental clarity application',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'Byteworthy Support',
        url: 'https://numira.app',
        email: 'support@numira.app',
      },
    },
    servers: [
      {
        url: `http://${config.server.host}:${config.server.port}${config.server.apiPrefix}`,
        description: 'Development server',
      },
      {
        url: 'https://api.numira.app/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Personas',
        description: 'AI persona endpoints',
      },
      {
        name: 'Conversations',
        description: 'Conversation management endpoints',
      },
      {
        name: 'Insights',
        description: 'Insight generation and retrieval endpoints',
      },
      {
        name: 'Notifications',
        description: 'Push notification endpoints',
      },
      {
        name: 'Payments',
        description: 'Payment processing endpoints',
      },
      {
        name: 'Health',
        description: 'System health and status endpoints',
      },
      {
        name: 'Compliance',
        description: 'Legal compliance endpoints',
      },
    ],
  },
  // Path to the API docs
  apis: [
    './routes/api/*.js',
    './routes/api/**/*.js',
    './models/*.js',
    './controllers/*.js',
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Function to setup Swagger UI
const setupSwagger = (app) => {
  if (process.env.SWAGGER_ENABLED !== 'true') {
    logger.info('Swagger documentation is disabled');
    return;
  }

  // Swagger documentation endpoint
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  }));

  // Serve swagger spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('Swagger documentation initialized at /api/docs');
};

module.exports = {
  setupSwagger,
  swaggerSpec,
};
