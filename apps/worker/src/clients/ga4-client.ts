/** Google Analytics 4 Data API client */
import { GoogleAuth } from 'google-auth-library';
import { logger } from '../utils/logger.js';

const log = logger('ga4-client');

interface GA4DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

interface GA4Dimension {
  name: string;
}

interface GA4Metric {
  name: string;
}

interface GA4ReportRequest {
  property: string;
  dateRanges: GA4DateRange[];
  dimensions: GA4Dimension[];
  metrics: GA4Metric[];
  pageSize?: number;
  pageToken?: string;
}

interface GA4DimensionValue {
  value: string;
}

interface GA4MetricValue {
  value: string;
}

interface GA4Row {
  dimensionValues: GA4DimensionValue[];
  metricValues: GA4MetricValue[];
}

interface GA4ReportResponse {
  rows?: GA4Row[];
  rowCount?: number;
  nextPageToken?: string;
}

export interface GA4ReportData {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  conversions: number;
  revenue: number;
  currency: string;
}

export class GA4Client {
  private auth: GoogleAuth;
  private propertyId: string;
  private baseURL = 'https://analyticsdata.googleapis.com/v1beta';

  constructor(credentialsJson: string, propertyId: string) {
    try {
      const credentials = JSON.parse(credentialsJson);
      this.auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
      this.propertyId = propertyId;
      log.info(`GA4 client initialized for property ${propertyId}`);
    } catch (error) {
      throw new Error(`GA4_AUTH_ERROR: Invalid credentials JSON: ${error}`);
    }
  }

  /**
   * Fetch daily report data
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @returns Array of daily report data
   */
  async getDailyReport(startDate: string, endDate: string): Promise<GA4ReportData[]> {
    log.info(`Fetching GA4 report for property ${this.propertyId} from ${startDate} to ${endDate}`);

    try {
      const accessToken = await this.auth.getAccessToken();
      if (!accessToken) {
        throw new Error('GA4_AUTH_ERROR: Failed to obtain access token');
      }

      const allRows = await this.fetchAllRows(startDate, endDate, accessToken);
      return this.normalizeRows(allRows);
    } catch (error) {
      log.error('GA4 report fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch all rows with pagination
   */
  private async fetchAllRows(
    startDate: string,
    endDate: string,
    accessToken: string
  ): Promise<GA4Row[]> {
    const allRows: GA4Row[] = [];
    let pageToken: string | undefined;

    do {
      const request: GA4ReportRequest = {
        property: `properties/${this.propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
        pageSize: 10000,
        pageToken,
      };

      const response = await fetch(`${this.baseURL}/properties/${this.propertyId}:runReport`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 403) {
          throw new Error(`GA4_PERMISSION_DENIED: ${errorText}`);
        }
        throw new Error(`GA4_API_ERROR: HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as GA4ReportResponse;

      if (data.rows) {
        allRows.push(...data.rows);
      }

      pageToken = data.nextPageToken;

      // Rate limiting: wait between pages
      if (pageToken) {
        await this.sleep(100);
      }
    } while (pageToken);

    log.info(`Fetched ${allRows.length} GA4 report rows`);
    return allRows;
  }

  /**
   * Normalize GA4 rows to our data format
   */
  private normalizeRows(rows: GA4Row[]): GA4ReportData[] {
    const normalized: GA4ReportData[] = [];

    for (const row of rows) {
      const dateValue = row.dimensionValues[0]?.value;
      if (!dateValue) continue;

      // Format date from YYYYMMDD to YYYY-MM-DD
      const formattedDate = `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`;

      normalized.push({
        date: formattedDate,
        sessions: parseInt(row.metricValues[0]?.value || '0', 10),
        users: parseInt(row.metricValues[1]?.value || '0', 10),
        pageviews: parseInt(row.metricValues[2]?.value || '0', 10),
        conversions: parseFloat(row.metricValues[3]?.value || '0'),
        revenue: parseFloat(row.metricValues[4]?.value || '0'),
        currency: 'USD', // GA4 reports in the property's currency, may need adjustment
      });
    }

    return normalized;
  }

  /**
   * Test connection and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      const accessToken = await this.auth.getAccessToken();
      if (!accessToken) {
        return false;
      }

      // Try a minimal query
      const today = new Date().toISOString().split('T')[0];
      await this.getDailyReport(today, today);
      log.info('GA4 connection test successful');
      return true;
    } catch (error) {
      log.error('GA4 connection test failed:', error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

