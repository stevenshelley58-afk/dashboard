/** Dashboard home page */
import { SyncStatusCard } from '@/components/SyncStatusCard';
import { RevenueChart } from '@/components/RevenueChart';
import { MarketingMetrics } from '@/components/MarketingMetrics';
import { SyncTrigger } from '@/components/SyncTrigger';

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Data Pipeline Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your ETL syncs, revenue, and marketing metrics</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Sync Trigger */}
          <div className="lg:col-span-1">
            <SyncTrigger />
          </div>

          {/* Right Column - Sync Status */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Syncs</h2>
              <SyncStatusCard />
            </div>
          </div>
        </div>

        {/* Revenue Section */}
        <div className="mb-8">
          <RevenueChart days={30} />
        </div>

        {/* Marketing Metrics Section */}
        <div className="mb-8">
          <MarketingMetrics days={30} />
        </div>
      </div>
    </main>
  );
}

