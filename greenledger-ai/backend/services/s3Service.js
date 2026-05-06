const fs = require('fs');
const path = require('path');

const LOCAL_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const uploadToS3 = async (fileBuffer, key, contentType) => {
  if (process.env.LOCAL_MODE === 'true') {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
    const localFilename = key.replace(/\//g, '_');
    fs.writeFileSync(path.join(LOCAL_UPLOADS_DIR, localFilename), fileBuffer);
    const port = process.env.PORT || 5000;
    return `http://localhost:${port}/uploads/${localFilename}`;
  }

  // Personal AWS account — permanent IAM keys, no session token.
  // Uses AWS_S3_* prefix to keep cleanly separated from any Bedrock creds.
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      ...(process.env.AWS_S3_SESSION_TOKEN && { sessionToken: process.env.AWS_S3_SESSION_TOKEN }),
    },
  });
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;
};

module.exports = { uploadToS3 };
