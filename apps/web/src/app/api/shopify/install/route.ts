import { NextRequest, NextResponse } from "next/server";
import { requireAccountIdFromRequest } from "@/lib/auth";
import {
  buildShopifyAuthorizeUrl,
  createShopifyStateToken,
  normalizeShopDomain,
} from "@/lib/shopify";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const shopParam = request.nextUrl.searchParams.get("shop");

    if (!shopParam) {
      return NextResponse.json(
        { error: "shop parameter is required" },
        { status: 400 }
      );
    }

    const accountId = requireAccountIdFromRequest(request);
    const shopDomain = normalizeShopDomain(shopParam);

    const state = createShopifyStateToken({ accountId, shopDomain });
    const authorizeUrl = buildShopifyAuthorizeUrl(shopDomain, state);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error("Failed to initiate Shopify install", error);
    return NextResponse.json(
      { error: "unable to start Shopify install" },
      { status: 400 }
    );
  }
}





