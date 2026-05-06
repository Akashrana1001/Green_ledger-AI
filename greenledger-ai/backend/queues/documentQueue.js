const { Queue } = require('bullmq');
const { getRedisConnection } = require('./redisConnection');

let documentQueue = null;

const getDocumentQueue = () => {
  if (!documentQueue) {
    documentQueue = new Queue('document-processing', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return documentQueue;
};

module.exports = { getDocumentQueue };
