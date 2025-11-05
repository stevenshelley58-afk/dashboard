/** API route to trigger syncs via Edge Function */
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Platform, JobType } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_id, platform, job_type } = body;

    // Validate request
    if (!shop_id || !platform || !job_type) {
      return NextResponse.json(
        { error: 'Missing required fields: shop_id, platform, job_type' },
        { status: 400 }
      );
    }

    if (!Object.values(Platform).includes(platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${Object.values(Platform).join(', ')}` },
        { status: 400 }
      );
    }

    if (!Object.values(JobType).includes(job_type)) {
      return NextResponse.json(
        { error: `Invalid job_type. Must be one of: ${Object.values(JobType).join(', ')}` },
        { status: 400 }
      );
    }

    // Get Supabase client and auth token
    const supabase = createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Call Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        shop_id,
        platform,
        job_type,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || `Edge Function error: ${response.statusText}` },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

