const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { processEconomicAlerts } = require('../../services/economicAlertService');

let alertQueue = null;
let alertWorker = null;
let redisConnection = null;

if (process.env.REDIS_URL) {
  try {
    redisConnection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    alertQueue = new Queue('economic-alerts', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    alertWorker = new Worker(
      'economic-alerts',
      async (job) => {
        if (job.name === 'sweep-alerts') {
          return await processEconomicAlerts(job.data?.referenceTime ? new Date(job.data.referenceTime) : new Date());
        }
      },
      {
        connection: redisConnection,
        concurrency: 1,
      }
    );

    console.log('[Economic Alert Queue] BullMQ initialized successfully');
  } catch (error) {
    console.warn('[Economic Alert Queue] Redis connection failed, falling back to scheduler sweep');
    alertQueue = null;
  }
}

/**
 * Triggers an economic alert evaluation job (via BullMQ if available, otherwise synchronous)
 */
async function triggerAlertSweepJob(referenceTime = new Date()) {
  if (alertQueue) {
    try {
      await alertQueue.add(
        'sweep-alerts',
        { referenceTime: referenceTime.toISOString() },
        { jobId: `alert-sweep-${Math.floor(Date.now() / 60000)}` } // deduplicate within same minute
      );
      return { mode: 'BULLMQ_QUEUED' };
    } catch (err) {
      console.warn('[Economic Alert Queue] Enqueue error, falling back to direct sweep:', err.message);
    }
  }

  // Direct synchronous fallback
  return await processEconomicAlerts(referenceTime);
}

module.exports = {
  alertQueue,
  alertWorker,
  triggerAlertSweepJob,
};
