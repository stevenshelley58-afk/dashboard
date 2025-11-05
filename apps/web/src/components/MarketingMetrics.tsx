/** Marketing metrics component (MER/ROAS) */
import { createClient } from '@/lib/supabase/server';

interface MerRoas {
  shop_id: string;
  date: string;
  platform: string;
  spend: number;
  marketing_currency: string;
  revenue: number;
  revenue_currency: string;
  roas: number | null;
  mer: number | null;
}

export async function MarketingMetrics({ days = 30 }: { days?: number }) {
  const supabase = createClient();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data: metrics, error } = await supabase
    .schema('reporting')
    .from('mer_roas')
    .select('*')
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading marketing metrics: {error.message}</p>
      </div>
    );
  }

  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No marketing data available for the selected period.</p>
      </div>
    );
  }

  // Group by platform
  const byPlatform = metrics.reduce((acc: Record<string, MerRoas[]>, metric: MerRoas) => {
    if (!acc[metric.platform]) {
      acc[metric.platform] = [];
    }
    acc[metric.platform].push(metric);
    return acc;
  }, {});

  const totals = Object.entries(byPlatform).map(([platform, data]) => {
    const platformData = data as MerRoas[];
    const totalSpend = platformData.reduce((sum, m) => sum + (m.spend || 0), 0);
    const totalRevenue = platformData.reduce((sum, m) => sum + (m.revenue || 0), 0);
    const avgROAS = platformData
      .filter(m => m.roas !== null)
      .reduce((sum, m, _, arr) => sum + (m.roas || 0) / arr.length, 0);
    const avgMER = platformData
      .filter(m => m.mer !== null)
      .reduce((sum, m, _, arr) => sum + (m.mer || 0) / arr.length, 0);
    
    return {
      platform,
      totalSpend,
      totalRevenue,
      avgROAS: avgROAS || (totalSpend > 0 ? totalRevenue / totalSpend : 0),
      avgMER: avgMER || (totalRevenue > 0 ? totalSpend / totalRevenue : 0),
      currency: platformData[0]?.marketing_currency || 'USD',
    };
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Marketing Performance ({days} days)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {totals.map((platform) => (
          <div key={platform.platform} className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">{platform.platform}</h4>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-600">Total Spend</p>
                <p className="text-lg font-bold">
                  {new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: platform.currency 
                  }).format(platform.totalSpend)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Total Revenue</p>
                <p className="text-lg font-bold">
                  {new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: platform.currency 
                  }).format(platform.totalRevenue)}
                </p>
              </div>
              <div className="flex gap-4 pt-2 border-t border-purple-200">
                <div>
                  <p className="text-xs text-gray-600">ROAS</p>
                  <p className="text-sm font-semibold text-green-700">
                    {platform.avgROAS.toFixed(2)}x
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">MER</p>
                  <p className="text-sm font-semibold text-blue-700">
                    {(platform.avgMER * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

