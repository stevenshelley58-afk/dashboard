/** Shopify GraphQL Admin API client */
import { HttpClient, HttpError } from '../utils/http-client.js';
import { logger } from '../utils/logger.js';

const log = logger('shopify-client');

export interface ShopifyClientOptions {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
}

export interface BulkOperation {
  id: string;
  status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  errorCode?: string;
  createdAt: string;
  completedAt?: string;
  objectCount?: string;
  fileSize?: string;
  url?: string;
  partialDataUrl?: string;
}

export interface BulkOperationResponse {
  bulkOperation: BulkOperation | null;
}

export interface BulkOperationRunResponse {
  bulkOperationRun: BulkOperation | null;
  userErrors?: Array<{ field: string[]; message: string }>;
}

export class ShopifyClient {
  private http: HttpClient;
  private baseURL: string;
  private apiVersion: string;
  private accessToken: string;
  private shopDomain: string;

  constructor(options: ShopifyClientOptions) {
    this.apiVersion = options.apiVersion || '2025-01';
    this.accessToken = options.accessToken;
    this.shopDomain = options.shopDomain;
    this.baseURL = `https://${options.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;

    this.http = new HttpClient({
      baseURL: this.baseURL,
      timeout: 60000, // 60s for bulk operations
      retries: 3,
      rateLimitRpm: 40, // Shopify allows 40 requests per app per store per minute
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': options.accessToken,
      },
    });
  }

  /**
   * Execute a GraphQL query
   */
  async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await this.http.post<{ data: T; errors?: Array<{ message: string }> }>('', {
        query,
        variables,
      });

      if (response.errors && response.errors.length > 0) {
        const errorMessages = response.errors.map((e) => e.message).join('; ');
        throw new Error(`Shopify GraphQL error: ${errorMessages}`);
      }

      return response.data;
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 401 || error.status === 403) {
          throw new Error('SHOPIFY_AUTH_ERROR: Invalid access token');
        }
        if (error.status === 429) {
          throw new Error('SHOPIFY_RATE_LIMIT: Rate limit exceeded');
        }
      }
      throw error;
    }
  }

  /**
   * Get shop information
   */
  async getShop(): Promise<{
    id: string;
    name: string;
    domain: string;
    currencyCode: string;
    timezoneAbbreviation: string;
    ianaTimezone: string;
  }> {
    const query = `
      query {
        shop {
          id
          name
          myshopifyDomain
          currencyCode
          timezoneAbbreviation
          ianaTimezone
        }
      }
    `;

    const result = await this.query<{ shop: any }>(query);
    return {
      id: result.shop.id,
      name: result.shop.name,
      domain: result.shop.myshopifyDomain,
      currencyCode: result.shop.currencyCode,
      timezoneAbbreviation: result.shop.timezoneAbbreviation,
      ianaTimezone: result.shop.ianaTimezone,
    };
  }

  /**
   * Create a bulk operation for historical data
   */
  async createBulkOperation(objectType: 'ORDERS' | 'PRODUCTS' | 'CUSTOMERS'): Promise<BulkOperation> {
    const query = `
      mutation bulkOperationRunQuery($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
            errorCode
            createdAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Build query based on object type
    let graphqlQuery = '';
    switch (objectType) {
      case 'ORDERS':
        graphqlQuery = `
          {
            orders {
              edges {
                node {
                  id
                  name
                  createdAt
                  updatedAt
                  processedAt
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  subtotalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  totalTaxSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  financialStatus
                  fulfillmentStatus
                  lineItems(first: 250) {
                    edges {
                      node {
                        id
                        title
                        quantity
                        originalUnitPriceSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                        discountedTotalSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
                  transactions(first: 250) {
                    edges {
                      node {
                        id
                        kind
                        status
                        processedAt
                        amountSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;
        break;
      case 'PRODUCTS':
        graphqlQuery = '{ products { edges { node { id name } } } }';
        break;
      case 'CUSTOMERS':
        graphqlQuery = '{ customers { edges { node { id email } } } }';
        break;
    }

    const variables = {
      query: graphqlQuery,
    };

    const result = await this.query<{ bulkOperationRunQuery: BulkOperationRunResponse }>(query, variables);

    if (result.bulkOperationRunQuery.userErrors && result.bulkOperationRunQuery.userErrors.length > 0) {
      const errors = result.bulkOperationRunQuery.userErrors.map((e) => e.message).join('; ');
      throw new Error(`Shopify bulk operation error: ${errors}`);
    }

    const bulkOp = result.bulkOperationRunQuery.bulkOperationRun;
    if (!bulkOp) {
      throw new Error('SHOPIFY_BULK_NOT_READY: Bulk operation not created');
    }

    return bulkOp;
  }

  /**
   * Poll for bulk operation status
   */
  async getBulkOperationStatus(id: string): Promise<BulkOperation> {
    const query = `
      query {
        node(id: "${id}") {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
            objectCount
            fileSize
            url
            partialDataUrl
          }
        }
      }
    `;

    const result = await this.query<{ node: BulkOperation }>(query);
    return result.node;
  }

  /**
   * Download and parse JSONL file from bulk operation URL
   */
  async downloadBulkOperationData(url: string): Promise<any[]> {
    log.info(`Downloading bulk operation data from ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download bulk operation data: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter((line) => line.trim());
    
    return lines.map((line) => JSON.parse(line));
  }

  /**
   * Get orders incrementally (since a date)
   */
  async getOrdersIncremental(sinceDate: string, limit: number = 250): Promise<any[]> {
    const query = `
      query getOrders($query: String!, $first: Int!, $after: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              updatedAt
              processedAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              financialStatus
              fulfillmentStatus
              lineItems(first: 250) {
                edges {
                  node {
                    id
                    title
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                    discountedTotalSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
              transactions(first: 250) {
                edges {
                  node {
                    id
                    kind
                    status
                    processedAt
                    amountSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      query: `created_at:>='${sinceDate}'`,
      first: limit,
    };

    const allOrders: any[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;

    while (hasNextPage) {
      const result = await this.query<{
        orders: {
          edges: Array<{ node: any; cursor: string }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      }>(query, { ...variables, after: cursor });

      const orders = result.orders.edges.map((edge) => edge.node);
      allOrders.push(...orders);

      hasNextPage = result.orders.pageInfo.hasNextPage;
      cursor = result.orders.pageInfo.endCursor || undefined;
    }

    return allOrders;
  }

  /**
   * Get shop payouts (for cash-to-bank view)
   */
  async getPayouts(limit: number = 250): Promise<any[]> {
    // Note: Payouts API is REST, not GraphQL
    const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/shopify_payments/payouts.json?limit=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('SHOPIFY_AUTH_ERROR: Invalid access token');
      }
      throw new Error(`Failed to fetch payouts: ${response.statusText}`);
    }

    const data = await response.json() as { payouts?: any[] };
    return data.payouts || [];
  }
}

