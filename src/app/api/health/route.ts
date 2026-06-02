import { NextResponse } from 'next/server';

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  'https://soroban-testnet.stellar.org';

/**
 * Health check endpoint for Docker HEALTHCHECK, uptime monitoring,
 * and degraded-network banner detection.
 * 
 * Returns app status and RPC reachability.
 */
export async function GET() {
  const healthCheck = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      app: 'healthy',
      rpc: 'unknown' as 'healthy' | 'unhealthy',
    },
    rpc_url: SOROBAN_RPC_URL,
  };

  // Check RPC reachability
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // Soroban RPC returns { status: "healthy" } when healthy
      if (data.result?.status === 'healthy') {
        healthCheck.services.rpc = 'healthy';
      } else {
        healthCheck.services.rpc = 'unhealthy';
        healthCheck.status = 'degraded';
      }
    } else {
      healthCheck.services.rpc = 'unhealthy';
      healthCheck.status = 'degraded';
    }
  } catch (error) {
    healthCheck.services.rpc = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  // If RPC is unhealthy, mark overall status as degraded
  if (healthCheck.services.rpc === 'unhealthy') {
    healthCheck.status = 'degraded';
  }

  // Return appropriate HTTP status code
  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

  return NextResponse.json(healthCheck, { status: statusCode });
}
