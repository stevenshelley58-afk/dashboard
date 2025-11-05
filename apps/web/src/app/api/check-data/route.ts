/** API route to check what data exists in Supabase */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use cookies

export async function GET() {
  try {
    const supabase = createClient();
    
    const results: Record<string, number> = {};

    // Check shops
    const { count: shopsCount } = await supabase
      .schema('core_warehouse')
      .from('shops')
      .select('*', { count: 'exact', head: true });
    results.shops = shopsCount || 0;

    // Check ETL runs
    const { count: etlRunsCount } = await supabase
      .schema('core_warehouse')
      .from('etl_runs')
      .select('*', { count: 'exact', head: true });
    results.etl_runs = etlRunsCount || 0;

    // Check orders
    const { count: ordersCount } = await supabase
      .schema('core_warehouse')
      .from('orders')
      .select('*', { count: 'exact', head: true });
    results.orders = ordersCount || 0;

    // Check marketing data
    const { count: marketingCount } = await supabase
      .schema('core_warehouse')
      .from('fact_marketing_daily')
      .select('*', { count: 'exact', head: true });
    results.marketing_data = marketingCount || 0;

    // Check user_shops
    const { count: userShopsCount } = await supabase
      .schema('app_dashboard')
      .from('user_shops')
      .select('*', { count: 'exact', head: true });
    results.user_shops = userShopsCount || 0;

    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        has_shops: results.shops > 0,
        has_etl_runs: results.etl_runs > 0,
        has_orders: results.orders > 0,
        has_marketing: results.marketing_data > 0,
        has_user_shops: results.user_shops > 0,
      },
    });
  } catch (error) {
    console.error('Error checking data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

