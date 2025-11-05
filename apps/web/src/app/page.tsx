/** Dashboard home page */
import { SyncStatusCard } from '@/components/SyncStatusCard';
import { RevenueChart } from '@/components/RevenueChart';
import { MarketingMetrics } from '@/components/MarketingMetrics';
import { SyncTrigger } from '@/components/SyncTrigger';
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic'; // Force dynamic rendering since we use Supabase

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your ETL syncs, revenue, and marketing metrics</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Sync Trigger */}
          <div className="lg:col-span-1">
            <ErrorBoundary>
              <SyncTrigger />
            </ErrorBoundary>
          </div>

          {/* Right Column - Sync Status */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Syncs</h2>
              <ErrorBoundary>
                <SyncStatusCard />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* Revenue Section */}
        <div className="mb-8">
          <ErrorBoundary>
            <RevenueChart days={30} />
          </ErrorBoundary>
        </div>

        {/* Marketing Metrics Section */}
        <div className="mb-8">
          <ErrorBoundary>
            <MarketingMetrics days={30} />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

