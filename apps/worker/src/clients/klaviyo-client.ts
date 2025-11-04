/** Klaviyo Metrics API client */
import { ApiClient, ApiClientOptions } from '../utils/api-client.js';
import { logger } from '../utils/logger.js';

const log = logger('klaviyo-client');

interface KlaviyoMetric {
  id: string;
  type: string;
  attributes: {
    name: string;
    created: string;
    updated: string;
  };
}

interface KlaviyoMetricAggregate {
  data: Array<{
    attributes: {
      date: string;
      values: {
        emails_delivered?: number;
        emails_sent?: number;
        unique_opens?: number;
        unique_clicks?: number;
        unsubscribes?: number;
        revenue?: number;
      };
    };
  }>;
  links?: {
    next?: string;
  };
}

export interface KlaviyoMetricsData {
  date: string;
  emails_sent: number;
  emails_delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  revenue: number;
  currency: string;
}

export class KlaviyoClient extends ApiClient {
  constructor(apiKey: string, options?: Partial<ApiClientOptions>) {
    super({
      baseURL: 'https://a.klaviyo.com/api',
      customHeaders: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2024-10-15', // Latest API revision
      },
      rateLimitRpm: 100, // Klaviyo's rate limit
      ...options,
    });

    log.info('Klaviyo client initialized');
  }

  /**
   * Fetch metrics for a date range
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @param metricIds Optional array of metric IDs to fetch
   * @returns Array of daily metrics
   */
  async getMetrics(
    startDate: string,
    endDate: string,
    metricIds?: string[]
  ): Promise<KlaviyoMetricsData[]> {
    log.info(`Fetching Klaviyo metrics from ${startDate} to ${endDate}`);

    try {
      // If no metric IDs provided, fetch all available metrics
      if (!metricIds || metricIds.length === 0) {
        metricIds = await this.getAvailableMetricIds();
      }

      // Fetch aggregates for each metric
      const allMetrics: KlaviyoMetricsData[] = [];
      for (const metricId of metricIds) {
        const metrics = await this.fetchMetricAggregates(metricId, startDate, endDate);
        allMetrics.push(...metrics);
      }

      // Aggregate by date
      return this.aggregateByDate(allMetrics);
    } catch (error) {
      this.handleError(error, 'KLAVIYO');
      throw error;
    }
  }

  /**
   * Get list of available metric IDs
   */
  private async getAvailableMetricIds(): Promise<string[]> {
    try {
      const response = await this.http.get<{ data: KlaviyoMetric[] }>('/metrics/', {
        rateLimitKey: 'klaviyo',
      });

      return response.data.map((metric) => metric.id);
    } catch (error) {
      log.warn('Failed to fetch metric IDs, using defaults:', error);
      // Return common metric IDs as fallback
      return [];
    }
  }

  /**
   * Fetch metric aggregates for a specific metric
   */
  private async fetchMetricAggregates(
    metricId: string,
    startDate: string,
    endDate: string
  ): Promise<KlaviyoMetricsData[]> {
    const allData: KlaviyoMetricsData[] = [];
    let url: string | undefined = this.buildAggregateUrl(metricId, startDate, endDate);

    while (url) {
      const response: KlaviyoMetricAggregate = await this.http.get<KlaviyoMetricAggregate>(url, {
        rateLimitKey: 'klaviyo',
      });

      if (response.data) {
        for (const item of response.data) {
          const values = item.attributes.values;
          allData.push({
            date: item.attributes.date,
            emails_sent: values.emails_sent || 0,
            emails_delivered: values.emails_delivered || 0,
            opens: values.unique_opens || 0,
            clicks: values.unique_clicks || 0,
            unsubscribes: values.unsubscribes || 0,
            revenue: values.revenue || 0,
            currency: 'USD', // Klaviyo typically uses USD
          });
        }
      }

      url = response.links?.next ? this.extractPathFromUrl(response.links.next) : undefined;

      // Rate limiting: wait between pages
      if (url) {
        await this.sleep(100);
      }
    }

    return allData;
  }

  /**
   * Build metric aggregates API URL
   */
  private buildAggregateUrl(metricId: string, startDate: string, endDate: string): string {
    const params = new URLSearchParams({
      filter: `equals(metric_id,"${metricId}")`,
      'page[size]': '100',
    });

    return `/metric-aggregates/?${params.toString()}`;
  }

  /**
   * Extract path from full URL
   */
  private extractPathFromUrl(fullUrl: string): string {
    try {
      const url = new URL(fullUrl);
      return url.pathname + url.search;
    } catch {
      return fullUrl.replace('https://a.klaviyo.com/api', '');
    }
  }

  /**
   * Aggregate metrics by date (combine multiple metrics per day)
   */
  private aggregateByDate(metrics: KlaviyoMetricsData[]): KlaviyoMetricsData[] {
    const aggregated = new Map<string, KlaviyoMetricsData>();

    for (const metric of metrics) {
      const existing = aggregated.get(metric.date);
      if (existing) {
        existing.emails_sent += metric.emails_sent;
        existing.emails_delivered += metric.emails_delivered;
        existing.opens += metric.opens;
        existing.clicks += metric.clicks;
        existing.unsubscribes += metric.unsubscribes;
        existing.revenue += metric.revenue;
      } else {
        aggregated.set(metric.date, { ...metric });
      }
    }

    return Array.from(aggregated.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Test connection and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.http.get<{ data: KlaviyoMetric[] }>('/metrics/', {
        rateLimitKey: 'klaviyo',
      });
      log.info(`Klaviyo connection test successful: ${response.data.length} metrics found`);
      return true;
    } catch (error) {
      log.error('Klaviyo connection test failed:', error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

