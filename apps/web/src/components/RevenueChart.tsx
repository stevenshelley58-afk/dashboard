/** Revenue chart component */
import { createClient } from '@/lib/supabase/server';

interface DailyRevenue {
  shop_id: string;
  date: string;
  order_count: number;
  revenue: number;
  aov: number;
  currency: string;
  timezone: string;
}

export async function RevenueChart({ days = 30 }: { days?: number }) {
  const supabase = createClient();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data: revenue, error } = await supabase
    .schema('reporting')
    .from('daily_revenue')
    .select('*')
    .gte('date', cutoffDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading revenue data: {error.message}</p>
      </div>
    );
  }

  if (!revenue || revenue.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No revenue data available for the selected period.</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...revenue.map((r: DailyRevenue) => r.revenue || 0));
  const currency = revenue[0]?.currency || 'USD';
  const totalRevenue = revenue.reduce((sum: number, r: DailyRevenue) => sum + (r.revenue || 0), 0);
  const totalOrders = revenue.reduce((sum: number, r: DailyRevenue) => sum + (r.order_count || 0), 0);
  const avgAOV = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Revenue Trend ({days} days)</h3>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold text-blue-900">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(totalRevenue)}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-2xl font-bold text-green-900">{totalOrders.toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Avg AOV</p>
          <p className="text-2xl font-bold text-purple-900">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(avgAOV)}
          </p>
        </div>
      </div>

      {/* Simple bar chart */}
      <div className="space-y-2">
        {revenue.map((day: DailyRevenue) => {
          const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={day.date} className="flex items-end gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-xs font-semibold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(day.revenue || 0)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${height}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

