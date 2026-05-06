const axios = require('axios');
const Settings = require('../models/Settings');
const Document = require('../models/Document');

/**
 * Reads the per-company inference mode from the Settings document.
 * Falls back to AWS Bedrock (the hackathon default) if no doc exists.
 */
const resolveLocalMode = async (companyId) => {
  try {
    const doc = await Settings.findOne({ companyId });
    return doc?.inferenceMode === 'local';
  } catch {
    return false;
  }
};

/**
 * Fetches the full s3Url from the Document record.
 * The AI engine uses this URL — not LOCAL_MODE — to decide whether to pull
 * the file from S3 (boto3) or a local backend (httpx). This decouples
 * storage location from AI model selection.
 */
const resolveS3Url = async (documentId) => {
  try {
    const doc = await Document.findById(documentId).select('s3Url');
    return doc?.s3Url || null;
  } catch {
    return null;
  }
};

const triggerProcessing = async (documentId, s3Key, brsrCategory, companyId) => {
  const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8000';
  const [localMode, s3Url] = await Promise.all([
    resolveLocalMode(companyId),
    resolveS3Url(documentId),
  ]);
  try {
    await axios.post(`${aiEngineUrl}/process`, {
      document_id:   documentId,
      s3_key:        s3Key,
      s3_url:        s3Url,       // Full URL — AI engine routes storage by this, not LOCAL_MODE
      brsr_category: brsrCategory,
      company_id:    companyId,
      local_mode:    localMode,   // Controls AI model only (Ollama vs Bedrock)
    });
  } catch (err) {
    console.error(`AI Engine trigger failed for document ${documentId}:`, err.message);
  }
};

module.exports = { triggerProcessing, resolveLocalMode };
