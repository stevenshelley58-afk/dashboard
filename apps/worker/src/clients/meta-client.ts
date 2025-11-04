/** Meta (Facebook Ads) API client */
import { ApiClient, ApiClientOptions } from '../utils/api-client.js';
import { logger } from '../utils/logger.js';

const log = logger('meta-client');

interface MetaInsight {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
  cpc?: string;
  cpp?: string;
  ctr?: string;
}

interface MetaInsightsResponse {
  data: MetaInsight[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

export interface MetaInsightsData {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  currency: string;
}

export class MetaClient extends ApiClient {
  private adAccountId: string;

  constructor(accessToken: string, adAccountId: string, options?: Partial<ApiClientOptions>) {
    super({
      baseURL: 'https://graph.facebook.com/v21.0',
      bearerToken: accessToken,
      rateLimitRpm: 200, // Meta's rate limit is typically 200 requests per hour per user
      ...options,
    });

    if (!adAccountId.startsWith('act_')) {
      this.adAccountId = `act_${adAccountId}`;
    } else {
      this.adAccountId = adAccountId;
    }
  }

  /**
   * Fetch insights for a date range
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @returns Array of daily insights
   */
  async getInsights(startDate: string, endDate: string): Promise<MetaInsightsData[]> {
    log.info(`Fetching Meta insights for ${this.adAccountId} from ${startDate} to ${endDate}`);

    try {
      const insights = await this.fetchAllInsights(startDate, endDate);
      return this.normalizeInsights(insights);
    } catch (error) {
      this.handleError(error, 'META');
      throw error;
    }
  }

  /**
   * Fetch all insights with pagination
   */
  private async fetchAllInsights(startDate: string, endDate: string): Promise<MetaInsight[]> {
    const allInsights: MetaInsight[] = [];
    let url: string | undefined = this.buildInsightsUrl(startDate, endDate);

    while (url) {
      const response: MetaInsightsResponse = await this.http.get<MetaInsightsResponse>(url, {
        rateLimitKey: 'meta',
      });

      if (response.data) {
        allInsights.push(...response.data);
      }

      url = response.paging?.next ? this.extractPathFromUrl(response.paging.next) : undefined;

      // Meta rate limiting: wait a bit between pages
      if (url) {
        await this.sleep(100);
      }
    }

    log.info(`Fetched ${allInsights.length} insight records`);
    return allInsights;
  }

  /**
   * Build insights API URL
   */
  private buildInsightsUrl(startDate: string, endDate: string): string {
    const params = new URLSearchParams({
      time_range: JSON.stringify({
        since: startDate,
        until: endDate,
      }),
      fields: [
        'date_start',
        'date_stop',
        'spend',
        'impressions',
        'clicks',
        'actions',
        'cpc',
        'cpp',
        'ctr',
      ].join(','),
      level: 'account',
      time_increment: '1', // Daily breakdown
    });

    return `/${this.adAccountId}/insights?${params.toString()}`;
  }

  /**
   * Extract path from full URL (Meta returns full URLs in pagination)
   */
  private extractPathFromUrl(fullUrl: string): string {
    try {
      const url = new URL(fullUrl);
      return url.pathname + url.search;
    } catch {
      return fullUrl.replace('https://graph.facebook.com', '');
    }
  }

  /**
   * Normalize Meta insights to our data format
   */
  private normalizeInsights(insights: MetaInsight[]): MetaInsightsData[] {
    const normalized: MetaInsightsData[] = [];

    for (const insight of insights) {
      // Extract conversion actions (purchase, lead, etc.)
      const conversionActions = insight.actions?.filter(
        (action) =>
          action.action_type === 'purchase' ||
          action.action_type === 'lead' ||
          action.action_type === 'offsite_conversion'
      ) || [];

      const conversions = conversionActions.reduce((sum, action) => {
        return sum + parseFloat(action.value || '0');
      }, 0);

      // Extract revenue from purchase actions
      const purchaseAction = insight.actions?.find((a) => a.action_type === 'purchase');
      const revenue = purchaseAction ? parseFloat(purchaseAction.value || '0') : 0;

      normalized.push({
        date: insight.date_start, // Use date_start as the canonical date
        spend: parseFloat(insight.spend || '0'),
        impressions: parseInt(insight.impressions || '0', 10),
        clicks: parseInt(insight.clicks || '0', 10),
        conversions: Math.round(conversions),
        revenue,
        currency: 'USD', // Meta typically uses USD, adjust if needed
      });
    }

    return normalized;
  }

  /**
   * Test connection and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.http.get<{ id: string; name?: string }>(
        `/${this.adAccountId}`,
        { rateLimitKey: 'meta' }
      );
      log.info(`Meta connection test successful: ${response.id}`);
      return true;
    } catch (error) {
      log.error('Meta connection test failed:', error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

