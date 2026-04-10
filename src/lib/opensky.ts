/**
 * OpenSky token cache — module-level singleton.
 * Acceptable for single-instance dev/preview deployments.
 * In multi-instance production, replace with a shared cache (Redis, etc.).
 */

interface TokenCache {
  accessToken: string
  expiresAt: number // ms since epoch
}

let tokenCache: TokenCache | null = null

export async function getOpenSkyToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  let res: Response
  try {
    res = await fetch(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        cache: 'no-store',
      }
    )
  } catch {
    return null
  }

  if (!res.ok) return null

  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return tokenCache.accessToken
}
