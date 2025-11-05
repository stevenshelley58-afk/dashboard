/** Shopify ETL processor */
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import { ShopifyClient } from '../clients/shopify-client.js';
import { loadToStaging, getIncrementalDateRange } from '../utils/etl-helpers.js';
import { getEnvConfig } from '../config/env.js';

const log = logger('shopify-etl');

export class ShopifyETL {
  private client: ShopifyClient | null = null;

  constructor(private pool: Pool) {}

  private getClient(): ShopifyClient {
    if (this.client) {
      return this.client;
    }

    const env = getEnvConfig();
    const accessToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const shopDomain = env.SHOPIFY_SHOP_DOMAIN;
    const apiVersion = env.SHOPIFY_API_VERSION || '2025-01';

    if (!accessToken || !shopDomain) {
      throw new Error('SHOPIFY_AUTH_ERROR: SHOPIFY_ADMIN_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN must be set');
    }

    this.client = new ShopifyClient({
      shopDomain,
      accessToken,
      apiVersion,
    });

    return this.client;
  }

  /**
   * Run historical sync using Bulk Operations API
   */
  async runHistorical(shopId: string, dbClient: PoolClient): Promise<number> {
    log.info(`Running historical Shopify sync for shop ${shopId}`);

    try {
      const client = this.getClient();

      // First, get shop info and create/update shop record
      const shopInfo = await client.getShop();
      await this.ensureShopExists(shopId, shopInfo, dbClient);

      // Create bulk operation for orders
      log.info('Creating bulk operation for orders...');
      const bulkOp = await client.createBulkOperation('ORDERS');

      // Poll for completion
      log.info(`Bulk operation ${bulkOp.id} created, polling for completion...`);
      let operation = bulkOp;
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes max (1 poll per second)

      while (operation.status === 'CREATED' || operation.status === 'RUNNING') {
        if (pollCount >= maxPolls) {
          throw new Error('SHOPIFY_BULK_NOT_READY: Bulk operation timed out');
        }

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Poll every 2 seconds
        operation = await client.getBulkOperationStatus(bulkOp.id);
        pollCount++;

        if (operation.status === 'FAILED' || operation.status === 'CANCELED') {
          throw new Error(
            `SHOPIFY_BULK_NOT_READY: Bulk operation ${operation.status}: ${operation.errorCode || 'Unknown error'}`
          );
        }

        if (pollCount % 10 === 0) {
          log.info(`Bulk operation status: ${operation.status} (poll ${pollCount})`);
        }
      }

      if (operation.status !== 'COMPLETED' || !operation.url) {
        throw new Error(`SHOPIFY_BULK_NOT_READY: Bulk operation ${operation.status} without URL`);
      }

      log.info(`Bulk operation completed. Downloading data from ${operation.url}`);

      // Download and parse JSONL
      const orders = await client.downloadBulkOperationData(operation.url);
      log.info(`Downloaded ${orders.length} orders from bulk operation`);

      if (orders.length === 0) {
        log.warn('No orders found in bulk operation');
        return 0;
      }

      // Process orders and extract related data
      const allRecords: any[] = [];
      const lineItems: any[] = [];
      const transactions: any[] = [];

      for (const order of orders) {
        // Store order
        allRecords.push(order);

        // Extract line items
        if (order.lineItems?.edges) {
          for (const edge of order.lineItems.edges) {
            lineItems.push({
              ...edge.node,
              order_id: order.id,
            });
          }
        }

        // Extract transactions
        if (order.transactions?.edges) {
          for (const edge of order.transactions.edges) {
            transactions.push({
              ...edge.node,
              order_id: order.id,
            });
          }
        }
      }

      // Load into staging
      const ordersLoaded = await loadToStaging(dbClient, 'shopify_orders_raw', shopId, allRecords);
      const lineItemsLoaded = lineItems.length > 0
        ? await loadToStaging(dbClient, 'shopify_line_items_raw', shopId, lineItems)
        : 0;
      const transactionsLoaded = transactions.length > 0
        ? await loadToStaging(dbClient, 'shopify_transactions_raw', shopId, transactions)
        : 0;

      log.info(
        `Loaded to staging: ${ordersLoaded} orders, ${lineItemsLoaded} line items, ${transactionsLoaded} transactions`
      );

      // Run transforms
      await this.runTransforms(shopId, dbClient);

      const totalRecords = ordersLoaded;
      log.info(`Historical Shopify sync completed: ${totalRecords} records`);
      return totalRecords;
    } catch (error) {
      log.error('Historical Shopify sync failed:', error);
      throw error;
    }
  }

  /**
   * Run incremental sync using GraphQL queries
   */
  async runIncremental(shopId: string, dbClient: PoolClient): Promise<number> {
    log.info(`Running incremental Shopify sync for shop ${shopId}`);

    try {
      const client = this.getClient();

      // Ensure shop exists
      const shopInfo = await client.getShop();
      await this.ensureShopExists(shopId, shopInfo, dbClient);

      // Get date range for incremental sync
      const { startDate } = await getIncrementalDateRange(dbClient, shopId, 'SHOPIFY', 30);
      const sinceDate = new Date(startDate).toISOString();

      log.info(`Fetching orders since ${sinceDate}`);

      // Fetch orders incrementally
      const orders = await client.getOrdersIncremental(sinceDate);

      if (orders.length === 0) {
        log.info('No new orders found');
        return 0;
      }

      log.info(`Fetched ${orders.length} orders from Shopify`);

      // Process orders and extract related data
      const lineItems: any[] = [];
      const transactions: any[] = [];

      for (const order of orders) {
        // Extract line items
        if (order.lineItems?.edges) {
          for (const edge of order.lineItems.edges) {
            lineItems.push({
              ...edge.node,
              order_id: order.id,
            });
          }
        }

        // Extract transactions
        if (order.transactions?.edges) {
          for (const edge of order.transactions.edges) {
            transactions.push({
              ...edge.node,
              order_id: order.id,
            });
          }
        }
      }

      // Load into staging
      const ordersLoaded = await loadToStaging(dbClient, 'shopify_orders_raw', shopId, orders);
      const lineItemsLoaded = lineItems.length > 0
        ? await loadToStaging(dbClient, 'shopify_line_items_raw', shopId, lineItems)
        : 0;
      const transactionsLoaded = transactions.length > 0
        ? await loadToStaging(dbClient, 'shopify_transactions_raw', shopId, transactions)
        : 0;

      log.info(
        `Loaded to staging: ${ordersLoaded} orders, ${lineItemsLoaded} line items, ${transactionsLoaded} transactions`
      );

      // Run transforms
      await this.runTransforms(shopId, dbClient);

      const totalRecords = ordersLoaded;
      log.info(`Incremental Shopify sync completed: ${totalRecords} records`);
      return totalRecords;
    } catch (error) {
      log.error('Incremental Shopify sync failed:', error);
      throw error;
    }
  }

  /**
   * Ensure shop record exists in core_warehouse.shops
   */
  private async ensureShopExists(shopId: string, shopInfo: any, dbClient: PoolClient): Promise<void> {
    await dbClient.query(
      `INSERT INTO core_warehouse.shops (shop_id, shop_domain, shop_name, currency, timezone, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (shop_id) DO UPDATE SET
         shop_domain = EXCLUDED.shop_domain,
         shop_name = EXCLUDED.shop_name,
         currency = EXCLUDED.currencyCode,
         timezone = EXCLUDED.ianaTimezone,
         updated_at = now()`,
      [shopId, shopInfo.domain, shopInfo.name, shopInfo.currencyCode, shopInfo.ianaTimezone]
    );
  }

  /**
   * Run SQL transforms to move data from staging to warehouse
   */
  private async runTransforms(shopId: string, dbClient: PoolClient): Promise<void> {
    log.info(`Running transforms for shop ${shopId}`);

    // Transform orders
    await dbClient.query(`SELECT transform_shopify_orders($1)`, [shopId]);

    // Transform line items
    await dbClient.query(`SELECT transform_shopify_line_items($1)`, [shopId]);

    // Transform transactions
    await dbClient.query(`SELECT transform_shopify_transactions($1)`, [shopId]);

    log.info('Transforms completed');
  }
}

