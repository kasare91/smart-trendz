import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError, ValidationError } from '@/lib/errors';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { uploadImageToSupabase } from '@/lib/supabase-storage';
import { getBusinessProfile } from '@/lib/business-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, { key: 'uploads:images', ...RATE_LIMITS.upload });
    if (limited) return limited;

    const profile = await getBusinessProfile();
    if (profile) {
      await requireAuth();
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const prefix = typeof formData.get('prefix') === 'string' ? String(formData.get('prefix')) : 'orders';

    if (!(file instanceof File)) {
      throw new ValidationError('Image file is required');
    }

    const uploaded = await uploadImageToSupabase(file, prefix);

    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Error uploading image:');
  }
}
