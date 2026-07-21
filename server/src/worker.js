const dotenv = require('dotenv');
const { validateProductionEnv } = require('./config/envValidator');

dotenv.config();
validateProductionEnv();

console.log('[Worker Process] Booting background infrastructure...');

const { startAIWorker } = require('./jobs/workers/aiWorker');

startAIWorker();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('[Worker Process] Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Worker Process] Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

console.log('[Worker Process] BullMQ initialized and listening for jobs in isolated thread.');
