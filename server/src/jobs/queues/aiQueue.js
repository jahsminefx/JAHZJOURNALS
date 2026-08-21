const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Fallback logic for when Redis isn't provided during dev
let aiQueue = null;
let redisConnection = null;

if (process.env.REDIS_URL) {
  try {
    redisConnection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    
    aiQueue = new Queue('ai-processing', { 
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    });
    console.log('[AI Queue] BullMQ initialized successfully');
  } catch (error) {
    console.warn('[AI Queue] Redis connection failed, falling back to synchronous processing');
    aiQueue = null;
  }
} else {
  console.warn('[AI Queue] REDIS_URL not set, falling back to synchronous processing');
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const triggerSyncFallback = async (jobName, jobData) => {
  // We dynamically require the worker to process it synchronously
  const { processJob } = require('../workers/aiWorker');
  console.log(`[AI Queue Sync Fallback] Processing ${jobName} synchronously`);
  
  try {
    // Mimic the BullMQ job object structure slightly
    await processJob({ name: jobName, data: jobData });
  } catch (error) {
    console.error(`[AI Queue Sync Fallback] Failed processing ${jobName}:`, error);
    if (jobData && jobData.aiRequestId) {
      await prisma.aiRequest.update({
        where: { id: jobData.aiRequestId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Synchronous execution failed',
          completedAt: new Date(),
        }
      }).catch(() => {});
    }
  }
};

const enqueueAiJob = async (jobName, jobData) => {
  if (aiQueue) {
    return await aiQueue.add(jobName, jobData);
  } else {
    // If no Redis, process synchronously in the background (fire and forget for this HTTP request)
    triggerSyncFallback(jobName, jobData).catch(err => console.error("Sync fallback error", err));
    return { id: `sync-${Date.now()}` };
  }
};

module.exports = {
  aiQueue,
  enqueueAiJob,
  redisConnection
};
