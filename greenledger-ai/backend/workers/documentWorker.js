const { Worker } = require('bullmq');
const axios = require('axios');
const Document = require('../models/Document');
const { getRedisConnection } = require('../queues/redisConnection');

const startDocumentWorker = () => {
  const worker = new Worker(
    'document-processing',
    async (job) => {
      const { documentId, s3Key, brsrCategory, companyId } = job.data;
      const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';

      // Resolve storage URL and inference mode in parallel while marking processing.
      // s3Url → AI engine routes storage by this URL, not by LOCAL_MODE.
      // localMode → AI engine picks Ollama vs Bedrock; independent of storage.
      const { resolveLocalMode } = require('../services/aiEngineService');
      const [docRecord, , localMode] = await Promise.all([
        Document.findById(documentId).select('s3Url'),
        Document.findByIdAndUpdate(documentId, {
          status: 'processing',
          $push: { processingLog: { message: `BullMQ job ${job.id} picked up by worker` } },
        }),
        resolveLocalMode(companyId),
      ]);
      const s3Url = docRecord?.s3Url || null;

      await axios.post(
        `${aiUrl}/process`,
        {
          document_id:   documentId,
          s3_key:        s3Key,
          s3_url:        s3Url,      // Full URL — storage routing (S3 vs local)
          brsr_category: brsrCategory,
          company_id:    companyId,
          local_mode:    localMode,  // AI model routing (Bedrock vs Ollama)
        },
        { timeout: 600000 }
      );
    },
    {
      connection: getRedisConnection(),
      concurrency: 1, // Process ONE document at a time to avoid OOM with local Ollama
    }
  );

  worker.on('completed', (job) => {
    console.log(`Document job ${job.id} completed (documentId: ${job.data.documentId})`);
  });

  worker.on('failed', async (job, err) => {
    /* ── Robust error extraction ─────────────────────────────────────────
     * BullMQ v5 serialises err.message → job.failedReason (a plain string
     * in Redis). On retry / final-fail events it reconstructs the error as
     * new Error(job.failedReason). If the original AxiosError or network
     * error lost its message during JSON serialisation, failedReason → ""
     * and err.message === "" — which console.error renders as blank.
     *
     * Fallback chain: err.message → job.failedReason → String(err) → constant.
     * If err is not even an Error instance (e.g. a thrown string or object),
     * the raw value is dumped separately so nothing is swallowed.          */
    const errMsg  = err?.message
                 || job?.failedReason
                 || (err != null ? String(err) : null)
                 || '(no error message — possible BullMQ serialisation loss)';

    const errType  = err?.constructor?.name ?? typeof err;
    const errStack = err?.stack ?? '(no stack trace)';
    const isAxios  = err?.isAxiosError === true;

    console.error('\n╔══════════════════════════════════════════════════╗');
    console.error('║  BULLMQ JOB FAILED                               ║');
    console.error('╠══════════════════════════════════════════════════╣');
    console.error(`  job id      : ${job?.id ?? '(unknown)'}`);
    console.error(`  attempt     : ${job?.attemptsMade ?? '?'} / ${job?.opts?.attempts ?? '?'}`);
    console.error(`  documentId  : ${job?.data?.documentId ?? '(missing)'}`);
    console.error(`  s3Key       : ${job?.data?.s3Key ?? '(missing)'}`);
    console.error(`  category    : ${job?.data?.brsrCategory ?? '(missing)'}`);
    console.error(`  error type  : ${errType}${isAxios ? ' [AxiosError]' : ''}`);
    console.error(`  error msg   : ${errMsg}`);
    if (isAxios) {
      /* Axios errors carry extra context that is lost if you only log .message */
      console.error(`  axios code  : ${err.code ?? '(none)'}`);
      console.error(`  http status : ${err.response?.status ?? '(no response)'}`);
      console.error(`  response    : ${JSON.stringify(err.response?.data ?? null)}`);
      console.error(`  request url : ${err.config?.url ?? '(unknown)'}`);
    }
    if (!(err instanceof Error)) {
      /* Thrown value is not an Error — dump the raw thing so nothing hides */
      console.error('  raw thrown  :', err);
    }
    console.error(`  stack:\n${errStack}`);
    console.error('╚══════════════════════════════════════════════════╝\n');

    if (job) {
      try {
        await Document.findByIdAndUpdate(job.data.documentId, {
          status: 'failed',
          $push: {
            processingLog: {
              message: `Job failed (attempt ${job.attemptsMade}): ${errMsg}`,
            },
          },
        });
      } catch (dbErr) {
        console.error('Failed to update document status after job failure:', dbErr.message);
      }
    }
  });

  console.log('Document processing worker started (concurrency: 1)');
  return worker;
};

module.exports = { startDocumentWorker };
