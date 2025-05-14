/**
 * Analytics Database Migration Script
 * 
 * Creates the necessary database tables and indexes for the analytics system.
 * This script should be run once during initial setup or when upgrading
 * an existing installation to add analytics capabilities.
 */

require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'numira'
});

/**
 * Create analytics_events table
 */
const createAnalyticsEventsTable = async () => {
  const client = await pool.connect();
  
  try {
    logger.info('Creating analytics_events table...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'analytics_events'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      logger.info('analytics_events table already exists, skipping creation');
    } else {
      // Create analytics_events table
      await client.query(`
        CREATE TABLE analytics_events (
          id SERIAL PRIMARY KEY,
          category VARCHAR(50) NOT NULL,
          action VARCHAR(50) NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL,
          user_id UUID,
          session_id VARCHAR(100),
          environment VARCHAR(20) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      
      logger.info('analytics_events table created successfully');
    }
    
    // Create indexes for efficient querying
    logger.info('Creating indexes on analytics_events table...');
    
    // Index on timestamp for time-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp 
      ON analytics_events (timestamp);
    `);
    
    // Index on category and action for filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_category_action 
      ON analytics_events (category, action);
    `);
    
    // Index on user_id for user-specific queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id 
      ON analytics_events (user_id);
    `);
    
    // Index on session_id for session-specific queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id 
      ON analytics_events (session_id);
    `);
    
    // Index on environment for environment-specific queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_environment 
      ON analytics_events (environment);
    `);
    
    // Create GIN index on JSONB data for efficient JSON querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_events_data 
      ON analytics_events USING GIN (data);
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info('Indexes created successfully');
    
    // Create retention policy function and trigger
    logger.info('Creating analytics data retention policy...');
    
    // Create function to delete old analytics data
    await client.query(`
      CREATE OR REPLACE FUNCTION delete_old_analytics_events() RETURNS TRIGGER AS $$
      BEGIN
        -- Delete events older than the retention period (default: 90 days)
        DELETE FROM analytics_events 
        WHERE timestamp < NOW() - INTERVAL '90 days';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create trigger to run the function daily
    await client.query(`
      DROP TRIGGER IF EXISTS trigger_delete_old_analytics_events ON analytics_events;
      
      CREATE TRIGGER trigger_delete_old_analytics_events
      AFTER INSERT ON analytics_events
      WHEN (pg_trigger_depth() = 0)
      EXECUTE FUNCTION delete_old_analytics_events();
    `);
    
    logger.info('Analytics data retention policy created successfully');
    
    // Create analytics_aggregates table for pre-computed metrics
    logger.info('Creating analytics_aggregates table...');
    
    // Check if table already exists
    const aggregatesTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'analytics_aggregates'
      );
    `);
    
    if (aggregatesTableCheck.rows[0].exists) {
      logger.info('analytics_aggregates table already exists, skipping creation');
    } else {
      // Create analytics_aggregates table
      await client.query(`
        CREATE TABLE analytics_aggregates (
          id SERIAL PRIMARY KEY,
          metric VARCHAR(50) NOT NULL,
          value NUMERIC NOT NULL,
          dimensions JSONB NOT NULL,
          period_start TIMESTAMPTZ NOT NULL,
          period_end TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (metric, dimensions, period_start, period_end)
        );
      `);
      
      logger.info('analytics_aggregates table created successfully');
    }
    
    // Create indexes for efficient querying of aggregates
    logger.info('Creating indexes on analytics_aggregates table...');
    
    // Index on metric for metric-specific queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_metric 
      ON analytics_aggregates (metric);
    `);
    
    // Index on period_start and period_end for time-based queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_period 
      ON analytics_aggregates (period_start, period_end);
    `);
    
    // Create GIN index on JSONB dimensions for efficient JSON querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_aggregates_dimensions 
      ON analytics_aggregates USING GIN (dimensions);
    `);
    
    logger.info('Analytics migration completed successfully');
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Error creating analytics tables:', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
};

/**
 * Main function to run the migration
 */
const runMigration = async () => {
  try {
    logger.info('Starting analytics database migration...');
    
    // Create analytics tables and indexes
    await createAnalyticsEventsTable();
    
    logger.info('Analytics database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Analytics database migration failed:', error);
    process.exit(1);
  }
};

// Run the migration
runMigration();
