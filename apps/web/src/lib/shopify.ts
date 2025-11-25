import crypto from "node:crypto";
import type { BinaryToTextEncoding } from "crypto";

interface ShopifyStatePayload {
  accountId: string;
  shopDomain: string;
  nonce: string;
  issuedAt: number;
}

export interface ShopifyShopDetails {
  shopifyGid?: string;
  myshopifyDomain: string;
  name?: string;
  currency?: string;
  timezone?: string;
}

const SHOPIFY_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_SCOPES = "read_orders,read_products,read_customers";
const WEBHOOK_TOPICS = ["orders/create", "orders/updated"] as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Please configure it in the environment.`);
  }
  return value;
}

function getAppBaseUrl(): string {
  // Check explicit config first, then Vercel's automatic URL
  if (process.env.SHOPIFY_APP_URL) {
    return process.env.SHOPIFY_APP_URL;
  }
  
  // Vercel provides VERCEL_URL automatically (without protocol)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback for local dev
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  throw new Error(
    "App URL not configured. Set SHOPIFY_APP_URL or deploy to Vercel."
  );
}

function getApiKey(): string {
  return requiredEnv("SHOPIFY_API_KEY");
}

function getApiSecret(): string {
  return requiredEnv("SHOPIFY_API_SECRET");
}

function getStateSecret(): string {
  return process.env.SHOPIFY_STATE_SECRET ?? getApiSecret();
}

function getScopes(): string {
  return process.env.SHOPIFY_SCOPES ?? DEFAULT_SCOPES;
}

function getApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION ?? "2025-01";
}

function createHmac(value: string, secret: string, encoding: BinaryToTextEncoding): string {
  return crypto.createHmac("sha256", secret).update(value, "utf8").digest(encoding);
}

export function normalizeShopDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    throw new Error("Shop parameter is required.");
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0];

  const domain = withoutPath.endsWith(".myshopify.com")
    ? withoutPath
    : `${withoutPath}.myshopify.com`;

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error("Shop domain must be a valid *.myshopify.com address.");
  }

  return domain;
}

export function buildShopifyAuthorizeUrl(shopDomain: string, state: string): URL {
  const redirectUri = new URL("/api/shopify/callback", getAppBaseUrl()).toString();

  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", getApiKey());
  url.searchParams.set("scope", getScopes());
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);

  return url;
}

export function createShopifyStateToken(params: {
  accountId: string;
  shopDomain: string;
}): string {
  const payload: ShopifyStatePayload = {
    accountId: params.accountId,
    shopDomain: params.shopDomain,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  };

  const json = JSON.stringify(payload);
  const signature = createHmac(json, getStateSecret(), "hex");
  const encodedPayload = Buffer.from(json, "utf8").toString("base64url");

  return `${encodedPayload}.${signature}`;
}

export function parseShopifyStateToken(state: string | null): ShopifyStatePayload | null {
  if (!state) {
    return null;
  }

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expectedSignature = createHmac(payloadJson, getStateSecret(), "hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson) as ShopifyStatePayload;
    if (Date.now() - payload.issuedAt > SHOPIFY_STATE_TTL_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function verifyShopifyOAuthHmac(params: URLSearchParams): boolean {
  const hmac = params.get("hmac");
  if (!hmac) {
    return false;
  }

  const entries = [...params.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  const message = entries.join("&");
  const expected = createHmac(message, getApiSecret(), "hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(hmac, "hex");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function verifyShopifyWebhookHmac(
  payload: string,
  headerValue: string | null
): boolean {
  if (!headerValue) {
    return false;
  }

  const digest = createHmac(payload, getApiSecret(), "base64");
  const expectedBuffer = Buffer.from(digest, "base64");
  const actualBuffer = Buffer.from(headerValue, "base64");

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function exchangeCodeForAccessToken(
  shopDomain: string,
  code: string
): Promise<{ accessToken: string; scope: string }> {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: getApiKey(),
      client_secret: getApiSecret(),
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange code for token (${response.status}): ${text}`);
  }

  const body = (await response.json()) as {
    access_token: string;
    scope: string;
  };

  return {
    accessToken: body.access_token,
    scope: body.scope,
  };
}

export async function fetchShopDetails(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyShopDetails> {
  const apiVersion = getApiVersion();
  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/shop.json`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch shop profile (${response.status}): ${text}`);
  }

  const { shop } = (await response.json()) as {
    shop: {
      id?: number | string;
      name?: string;
      myshopify_domain?: string;
      currency?: string;
      iana_timezone?: string;
      timezone?: string;
    };
  };

  const numericId =
    typeof shop.id === "number" ? shop.id.toString() : shop.id ?? undefined;

  return {
    shopifyGid: numericId ? `gid://shopify/Shop/${numericId}` : undefined,
    myshopifyDomain: shop.myshopify_domain ?? shopDomain,
    name: shop.name,
    currency: shop.currency,
    timezone: shop.iana_timezone ?? shop.timezone,
  };
}

function buildWebhookAddress(topic: string): string {
  return new URL(`/api/webhooks/shopify/${topic}`, getAppBaseUrl()).toString();
}

async function fetchExistingWebhooks(
  shopDomain: string,
  accessToken: string,
  topic: string
) {
  const apiVersion = getApiVersion();
  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/webhooks.json?topic=${encodeURIComponent(
      topic
    )}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to fetch existing webhooks (${topic}) – ${response.status}: ${text}`
    );
  }

  const data = (await response.json()) as { webhooks: Array<{ id: number; address: string }> };
  return data.webhooks;
}

async function createWebhook(
  shopDomain: string,
  accessToken: string,
  topic: string,
  address: string
) {
  const apiVersion = getApiVersion();
  const response = await fetch(
    `https://${shopDomain}/admin/api/${apiVersion}/webhooks.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        webhook: {
          topic,
          address,
          format: "json",
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create webhook (${topic}) – ${response.status}: ${text}`);
  }
}

export async function ensureShopifyWebhooks(
  shopDomain: string,
  accessToken: string
): Promise<void> {
  for (const topic of WEBHOOK_TOPICS) {
    const address = buildWebhookAddress(topic);
    const existing = await fetchExistingWebhooks(shopDomain, accessToken, topic);
    const alreadyRegistered = existing.some((hook) => hook.address === address);
    if (!alreadyRegistered) {
      await createWebhook(shopDomain, accessToken, topic, address);
    }
  }
}

export function getWebhookTopics(): string[] {
  return [...WEBHOOK_TOPICS];
}

export function getAppSettingsUrl(search = ""): URL {
  const path = `/settings${search}`;
  return new URL(path, getAppBaseUrl());
}




