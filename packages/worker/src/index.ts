/**
 * Temporal Worker Entry Point
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from '@/activities';
import { createLogger } from '@devflow/common';
import * as dotenv from 'dotenv';
import { oauthResolver } from '@/services/oauth-context';

dotenv.config();

const logger = createLogger('Worker');

async function run() {
  // Initialize OAuth context for activities
  logger.info('Initializing OAuth context...');
  try {
    await oauthResolver.initialize();
    logger.info('OAuth context initialized successfully');
  } catch (error) {
    logger.warn('Failed to initialize OAuth context, falling back to env vars', error);
    // Continue with fallback to env vars
  }

  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'devflow',
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  logger.info('Temporal worker started', {
    namespace: process.env.TEMPORAL_NAMESPACE,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE,
  });

  // Graceful shutdown
  const shutdownHandler = async () => {
    logger.info('Shutting down worker...');
    await oauthResolver.cleanup();
    await worker.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);

  await worker.run();
}

run().catch((err) => {
  logger.error('Worker failed', err);
  process.exit(1);
});

