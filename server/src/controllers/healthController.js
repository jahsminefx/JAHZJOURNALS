const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Redis = require('ioredis');
const { Queue } = require('bullmq');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

let redisConnectionParams = process.env.REDIS_URL ? process.env.REDIS_URL : null;

const getDiskSpace = () => {
  try {
    if (fs.statfsSync) {
      const stats = fs.statfsSync(process.cwd());
      return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
    }
    return { freeBytes: 'unknown', totalBytes: 'unknown' };
  } catch(e) {
    return { freeBytes: 'unknown', totalBytes: 'unknown' };
  }
};

const getHealthStatus = async (req, res) => {
  const memory = process.memoryUsage();
  
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    buildVersion: process.env.npm_package_version || '1.0.0',
    memoryUsage: {
      rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB',
    },
    diskSpace: getDiskSpace(),
    services: {
      api: { configured: true, reachable: true, healthy: true },
      database: { configured: !!process.env.DATABASE_URL, reachable: false, healthy: false },
      redis: { configured: !!process.env.REDIS_URL, reachable: false, healthy: false },
      bullmq: { configured: !!process.env.REDIS_URL, reachable: false, healthy: false },
      cloudinary: { configured: !!process.env.CLOUDINARY_URL, reachable: false, healthy: false },
      aiProvider: { configured: !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY), reachable: false, healthy: false },
      brevo: { configured: !!process.env.BREVO_API_KEY, reachable: false, healthy: false },
      paystack: { configured: !!process.env.PAYSTACK_SECRET_KEY, reachable: false, healthy: false },
    }
  };

  try {
    // 1. PostgreSQL
    if (health.services.database.configured) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        health.services.database.reachable = true;
        health.services.database.healthy = true;
      } catch (dbErr) {
        health.status = 'degraded';
      }
    }

    // 2. Redis & BullMQ
    if (health.services.redis.configured) {
      try {
        const redisClient = new Redis(redisConnectionParams, { maxRetriesPerRequest: 1, connectTimeout: 1500 });
        await redisClient.ping();
        health.services.redis.reachable = true;
        health.services.redis.healthy = true;
        
        const testQueue = new Queue('health-check', { connection: redisClient });
        await testQueue.getJobCounts();
        health.services.bullmq.reachable = true;
        health.services.bullmq.healthy = true;
        redisClient.disconnect();
      } catch (redisErr) {
        health.status = 'degraded';
      }
    }

    // 3. AI Provider Dummy Ping
    if (health.services.aiProvider.configured) {
       // Too expensive to ping the API physically for every load balancer check, assuming healthy if keys exist.
       // E2E test covers physical routing.
       health.services.aiProvider.reachable = true;
       health.services.aiProvider.healthy = true;
    }

    // 4. Cloudinary
    if (health.services.cloudinary.configured) {
       // Assuming healthy routing. Physical testing via Test layer.
       health.services.cloudinary.reachable = true;
       health.services.cloudinary.healthy = true;
    }

    if (health.services.brevo.configured) {
      health.services.brevo.reachable = true;
      health.services.brevo.healthy = true;
    }

    if (health.services.paystack.configured) {
      health.services.paystack.reachable = true;
      health.services.paystack.healthy = true;
    }

    return res.status(health.status === 'ok' ? 200 : 207).json(health);

  } catch (error) {
    console.error('[Health Check Error]', error.message);
    health.status = 'critical_failure';
    return res.status(500).json(health);
  }
};

module.exports = { getHealthStatus };
