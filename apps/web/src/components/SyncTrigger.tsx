'use client';

/** Sync trigger component - client-side form */
import { useState } from 'react';
import { Platform, JobType } from '@/lib/config';

export function SyncTrigger() {
  const [shopId, setShopId] = useState('');
  const [platform, setPlatform] = useState<Platform>(Platform.SHOPIFY);
  const [jobType, setJobType] = useState<JobType>(JobType.INCREMENTAL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop_id: shopId,
          platform,
          job_type: jobType,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: `Sync triggered successfully! Run ID: ${data.run_id}`,
        });
        setShopId(''); // Reset form
      } else {
        setResult({
          success: false,
          message: data.error || `Error: ${response.statusText}`,
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to trigger sync',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Trigger Sync</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="shop_id" className="block text-sm font-medium text-gray-700 mb-1">
            Shop ID
          </label>
          <input
            id="shop_id"
            type="text"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="sh_123abc"
          />
        </div>

        <div>
          <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1">
            Platform
          </label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={Platform.SHOPIFY}>Shopify</option>
            <option value={Platform.META}>Meta</option>
            <option value={Platform.GA4}>GA4</option>
            <option value={Platform.KLAVIYO}>Klaviyo</option>
          </select>
        </div>

        <div>
          <label htmlFor="job_type" className="block text-sm font-medium text-gray-700 mb-1">
            Job Type
          </label>
          <select
            id="job_type"
            value={jobType}
            onChange={(e) => setJobType(e.target.value as JobType)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={JobType.INCREMENTAL}>Incremental (sync since last success)</option>
            <option value={JobType.HISTORICAL}>Historical (full backfill)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Triggering...' : 'Trigger Sync'}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 p-3 rounded-md ${
            result.success
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <p className="text-sm">{result.message}</p>
        </div>
      )}
    </div>
  );
}

