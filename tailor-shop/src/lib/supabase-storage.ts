import crypto from 'crypto';
import { AppError, ValidationError } from './errors';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function uploadImageToSupabase(file: File, prefix = 'orders') {
  validateImage(file);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new AppError(500, 'STORAGE_NOT_CONFIGURED', 'Image storage is not available');
  }

  const extension = getExtension(file);
  const path = `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path}`;
  const bytes = await file.arrayBuffer();

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': file.type,
      'x-upsert': 'false',
    },
    body: bytes,
  });

  if (!response.ok) {
    const message = await response.text();
    console.error('Supabase upload failed:', message);
    throw new Error('Failed to upload image');
  }

  return {
    path,
    // NOTE: This URL only works if the bucket's access policy is set to Public in Supabase dashboard.
    url: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`,
    contentType: file.type,
    size: file.size,
  };
}

function validateImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new ValidationError('Only JPG, PNG, WEBP, and GIF images are supported');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new ValidationError('Image must be 5MB or smaller');
  }
}

function getExtension(file: File) {
  const byType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return byType[file.type] || file.name.split('.').pop()?.toLowerCase() || 'bin';
}
