/** Sync status card component */
import { createClient } from '@/lib/supabase/server';
import { RunStatus, Platform, JobType } from '@/lib/config';

interface SyncStatus {
  run_id: string;
  shop_id: string;
  shop_name: string | null;
  status: RunStatus;
  job_type: JobType;
  platform: Platform;
  records_synced: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: { code?: string; message?: string } | null;
}

export async function SyncStatusCard() {
  const supabase = createClient();
  
  const { data: syncs, error } = await supabase
    .schema('reporting')
    .from('sync_status')
    .select('*')
    .limit(10)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error loading sync status: {error.message}</p>
      </div>
    );
  }

  if (!syncs || syncs.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No syncs yet. Trigger a sync to get started.</p>
      </div>
    );
  }

  const getStatusColor = (status: RunStatus) => {
    switch (status) {
      case RunStatus.SUCCEEDED:
        return 'bg-green-100 text-green-800 border-green-200';
      case RunStatus.FAILED:
        return 'bg-red-100 text-red-800 border-red-200';
      case RunStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case RunStatus.QUEUED:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case RunStatus.PARTIAL:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-3">
      {syncs.map((sync: SyncStatus) => (
        <div
          key={sync.run_id}
          className={`border rounded-lg p-4 ${getStatusColor(sync.status)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">{sync.shop_name || sync.shop_id}</span>
                <span className="text-sm opacity-75">•</span>
                <span className="text-sm font-medium">{sync.platform}</span>
                <span className="text-sm opacity-75">•</span>
                <span className="text-sm">{sync.job_type}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium">Status: {sync.status}</span>
                {sync.records_synced !== null && (
                  <span>Records: {sync.records_synced.toLocaleString()}</span>
                )}
                <span className="text-xs opacity-75">
                  {new Date(sync.created_at).toLocaleString()}
                </span>
              </div>
              {sync.error && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                  <p className="font-semibold text-red-900">Error:</p>
                  <p className="text-red-800">
                    {sync.error.code || 'UNKNOWN'}: {sync.error.message || JSON.stringify(sync.error)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

