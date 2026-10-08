import 'dotenv/config';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { GetObjectCommand, HeadObjectCommand, ListBucketsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Uploaded images and videos live in Cloudflare R2 when it is configured; otherwise (local development without
// keys) they fall back to the server/uploads folder. Either way the stored path is "/uploads/<key>" and
// index.js serves that path, so switching storage never changes what is saved in the database.
const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
export const r2Enabled = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
export const publicUrl = (R2_PUBLIC_URL || '').replace(/\/$/, '');
export const localDir = new URL('../uploads', import.meta.url).pathname;

export const s3 = R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new S3Client({ region: 'auto', endpoint: R2_ENDPOINT, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  : null;

export async function saveUpload(key, body, contentType) {
  if (r2Enabled) {
    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
  } else {
    if (!existsSync(localDir)) mkdirSync(localDir, { recursive: true });
    writeFileSync(`${localDir}/${key}`, body);
  }
  return `/uploads/${key}`;
}

// Streams one object for the /uploads route when the bucket has no public URL.
export const fetchUpload = (key) => s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
export const uploadExists = (key) => s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })).then(() => true, () => false);
export const listBuckets = () => s3.send(new ListBucketsCommand({})).then((r) => (r.Buckets || []).map((b) => b.Name));
export const readLocal = (key) => readFileSync(`${localDir}/${key}`);
