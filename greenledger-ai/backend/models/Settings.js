const mongoose = require('mongoose');

/**
 * Settings — singleton document keyed per company that holds runtime
 * toggles editable from the Admin UI without restarting the server.
 *
 * Currently the only flag is `inferenceMode` (local vs aws). Add more
 * fields here when you need new toggles; keep them all in one document
 * so the frontend can fetch the whole config in a single request.
 */
const settingsSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true,
    },
    /* 'aws' = AWS Bedrock (default, hackathon mandate)
     * 'local' = Ollama on localhost — only set after the UI verifies
     *           the local engine is actually reachable.                */
    inferenceMode: {
      type: String,
      enum: ['aws', 'local'],
      default: 'aws',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
