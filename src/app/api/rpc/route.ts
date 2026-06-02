import { NextRequest, NextResponse } from 'next/server';

// Server-side RPC URL with API key (never exposed to browser)
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL;
const TESTNET_RPC_URL = process.env.TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

// Rate limiting: simple in-memory store (use Redis for production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute per IP

/**
 * Simple rate limiter for RPC proxy.
 * In production, replace with Redis or a dedicated rate-limiting service.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * RPC proxy endpoint.
 * Forwards JSON-RPC requests to the Soroban RPC server while keeping API keys server-side.
 * 
 * Usage: POST /api/rpc with JSON-RPC body
 * 
 * Example:
 * POST /api/rpc
 * {
 *   "jsonrpc": "2.0",
 *   "id": 1,
 *   "method": "getHealth"
 * }
 */
export async function POST(request: NextRequest) {
  // Get client IP for rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';

  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }

  // Select RPC URL based on network
  const rpcUrl = NETWORK === 'mainnet' ? MAINNET_RPC_URL : TESTNET_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json(
      { error: 'RPC URL not configured for this network' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    // Validate JSON-RPC request
    if (!body.jsonrpc || !body.method) {
      return NextResponse.json(
        { error: 'Invalid JSON-RPC request' },
        { status: 400 }
      );
    }

    // Forward request to RPC server
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `RPC server returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('RPC proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to process RPC request' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check of the RPC proxy.
 */
export async function GET() {
  const rpcUrl = NETWORK === 'mainnet' ? MAINNET_RPC_URL : TESTNET_RPC_URL;

  if (!rpcUrl) {
    return NextResponse.json(
      { status: 'error', message: 'RPC URL not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        status: 'healthy',
        network: NETWORK,
        rpcHealth: data.result?.status || 'unknown',
      });
    }

    return NextResponse.json(
      { status: 'degraded', network: NETWORK },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      { status: 'unhealthy', network: NETWORK },
      { status: 503 }
    );
  }
}
