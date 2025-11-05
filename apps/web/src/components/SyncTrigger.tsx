'use client';

/** Sync trigger component - client-side form */
import { useState } from 'react';
import { Platform, JobType } from '@/lib/config';
import { ShopSelector } from './ShopSelector';

export function SyncTrigger() {
  const [shopId, setShopId] = useState('');
  const [platform, setPlatform] = useState<Platform>(Platform.SHOPIFY);
  const [jobType, setJobType] = useState<JobType>(JobType.INCREMENTAL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedShopId = shopId.trim();
    
    // Validate form before submitting
    if (!trimmedShopId) {
      setResult({
        success: false,
        message: 'Please enter or select a shop ID',
      });
      return;
    }

    if (!platform || !jobType) {
      setResult({
        success: false,
        message: 'Please select both platform and job type',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Ensure values are strings (handle enum conversion)
      const requestBody = {
        shop_id: trimmedShopId,
        platform: typeof platform === 'string' ? platform : String(platform),
        job_type: typeof jobType === 'string' ? jobType : String(jobType),
      };

      // Double-check values before sending
      if (!requestBody.shop_id || !requestBody.platform || !requestBody.job_type) {
        console.error('Request body validation failed:', requestBody);
        setResult({
          success: false,
          message: `Missing values: shop_id=${!!requestBody.shop_id}, platform=${!!requestBody.platform}, job_type=${!!requestBody.job_type}`,
        });
        setLoading(false);
        return;
      }

      console.log('Sending sync request:', {
        requestBody,
        shopId: trimmedShopId,
        platform: String(platform),
        jobType: String(jobType),
        platformEnum: platform,
        jobTypeEnum: jobType,
      });

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        console.error('Failed to parse response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (response.ok) {
        setResult({
          success: true,
          message: `Sync triggered successfully! Run ID: ${data.run_id}`,
        });
        setShopId(''); // Reset form
        // Refresh the page after a short delay to show the new sync
        setTimeout(() => {
          window.location.reload();
        }, 1500);
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
            Shop
          </label>
          <ShopSelector
            value={shopId}
            onChange={setShopId}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1">
            Platform
          </label>
          <select
            id="platform"
            value={platform}
            onChange={(e) => {
              const val = e.target.value as Platform;
              console.log('Platform changed:', { val, enumValue: Platform[val as keyof typeof Platform] });
              setPlatform(val);
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SHOPIFY">Shopify</option>
            <option value="META">Meta</option>
            <option value="GA4">GA4</option>
            <option value="KLAVIYO">Klaviyo</option>
          </select>
        </div>

        <div>
          <label htmlFor="job_type" className="block text-sm font-medium text-gray-700 mb-1">
            Job Type
          </label>
          <select
            id="job_type"
            value={jobType}
            onChange={(e) => {
              const val = e.target.value as JobType;
              console.log('Job type changed:', { val, enumValue: JobType[val as keyof typeof JobType] });
              setJobType(val);
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="INCREMENTAL">Incremental (sync since last success)</option>
            <option value="HISTORICAL">Historical (full backfill)</option>
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

