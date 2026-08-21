const { Worker } = require('bullmq');
const { redisConnection } = require('../queues/aiQueue');
const { processTradeReview } = require('../processors/processTradeReview');
const { processWeeklyCoach } = require('../processors/processWeeklyCoach');
const { processEdgeFinder } = require('../processors/processEdgeFinder');
const { processVisionAnalysis } = require('../processors/processVisionAnalysis');
const { processJournalDraft } = require('../processors/processJournalDraft');

const processJob = async (job) => {
  const { name, data } = job;
  switch (name) {
    case 'processTradeReview':
      return await processTradeReview(data);
    case 'processWeeklyCoach':
      return await processWeeklyCoach(data);
    case 'processEdgeFinder':
      return await processEdgeFinder(data);
    case 'processVisionAnalysis':
        console.log(`Processing Vision Analysis for requestId: ${job.data.aiRequestId}`);
        await processVisionAnalysis(job.data);
        break;
      case 'processJournalDraft':
        console.log(`Processing Journal Draft for requestId: ${job.data.aiRequestId}`);
        await processJournalDraft(job.data);
        break;
      default:
      console.warn(`[AI Worker] Unknown job name: ${name}`);
      return null;
  }
};

let worker = null;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const startAIWorker = () => {
  if (redisConnection) {
    worker = new Worker('ai-processing', async (job) => {
      console.log(`[AI Worker] Processing job ${job.id} of type ${job.name}`);
      return await processJob(job);
    }, { 
      connection: redisConnection,
      concurrency: 5
    });

    worker.on('completed', job => {
      console.log(`[AI Worker] Job ${job.id} completed successfully`);
    });

    worker.on('failed', async (job, err) => {
      console.error(`[AI Worker] Job ${job?.id} failed with error:`, err);
      if (job?.data?.aiRequestId) {
        await prisma.aiRequest.update({
          where: { id: job.data.aiRequestId },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'Background worker processing failed',
            completedAt: new Date(),
          }
        }).catch(() => {});
      }
    });
  }
};

module.exports = {
  startAIWorker,
  processJob
};
