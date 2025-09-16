import { NextRequest } from 'next/server'
import { formatUiAmount } from '@/lib/utils'

type TokenLargestAccount = {
  address: string
  amount: string
  decimals: number
  uiAmountString: string
}

type ParsedTokenAccount = {
  pubkey: string
  owner: string
  amount: string // raw amount
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mint = searchParams.get('mint')?.trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 2), 10)
  const rpcOverride = searchParams.get('rpc')?.trim()
  const rpcUrl = rpcOverride || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  if (!mint) {
    return Response.json({ error: 'Missing `mint` query param' }, { status: 400 })
  }
  if (!/^\w{32,44}$/.test(mint)) {
    return Response.json({ error: 'Invalid mint address format' }, { status: 400 })
  }

  try {
    // Resolve which token program this mint belongs to (SPL Token or Token-2022)
    const programOwner = await resolveTokenProgramOwner(rpcUrl, mint)

    // Phase 1: getTokenLargestAccounts to get top token accounts for the mint
    // Prefer passing programId when known to support token-2022 mints.
    const largestRes = await getLargestAccounts(rpcUrl, mint, programOwner)
    const largest = largestRes?.value || []
    if (!largest || largest.length === 0) {
      return Response.json({ mint, limit, holders: [], fetchedAt: new Date().toISOString(), rpcUrl })
    }
    const decimals = largest[0]?.decimals ?? 0

    // Gather token account addresses (cap to, say, 30 just in case)
    const tokenAccountAddrs = largest.slice(0, 30).map(x => x.address)

    // Phase 2: getMultipleAccounts with jsonParsed to find the owner of each token account
    const parsedRes = await rpcCall<{ value: any[] }>(rpcUrl, 'getMultipleAccounts', [tokenAccountAddrs, { encoding: 'jsonParsed', commitment: 'confirmed' }])
    const parsedOwners: Record<string, string> = {}
    parsedRes.value.forEach((acc, i) => {
      const addr = tokenAccountAddrs[i]
      const owner = acc?.data?.parsed?.info?.owner
      if (addr && owner) parsedOwners[addr] = owner
    })

    // Aggregate by owner
    const byOwner = new Map<string, bigint>()
    for (const item of largest) {
      const owner = parsedOwners[item.address]
      if (!owner) continue
      const amt = BigInt(item.amount)
      byOwner.set(owner, (byOwner.get(owner) || 0n) + amt)
    }

    // Rank by amount desc and take top N
    const ranked = [...byOwner.entries()]
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
      .slice(0, limit)

    const holders = ranked.map(([owner, amountRaw]) => ({
      owner,
      amountRaw: amountRaw.toString(),
      decimals,
      uiAmount: formatUiAmount(amountRaw, decimals),
    }))

    return Response.json({
      mint,
      limit,
      holders,
      fetchedAt: new Date().toISOString(),
      rpcUrl,
      note: 'Owners aggregated from top token accounts via getTokenLargestAccounts; supports SPL Token and Token-2022 mints.'
    })
  } catch (err: any) {
    console.error('holders API error', err)
    const message = err?.message || 'Internal error'
    const hint = message.includes('could not find mint')
      ? 'The given address is not a token mint on this cluster or RPC. Ensure the mint exists on the selected network, or try a different RPC.'
      : undefined
    return Response.json({ error: message, hint }, { status: 500 })
  }
}

async function rpcCall<T>(rpcUrl: string, method: string, params: any[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'wheel', method, params }),
    // 20s timeout (works on Node < 18.17 too)
    signal: timeoutSignal(20000),
  })
  if (!res.ok) throw new Error(`RPC HTTP error: ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error?.message || 'RPC error')
  return json.result as T
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  // Prefer native AbortSignal.timeout where available
  try {
    // @ts-ignore
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      // @ts-ignore
      return AbortSignal.timeout(ms)
    }
  } catch {}
  // Polyfill with AbortController
  try {
    const ac = new AbortController()
    setTimeout(() => ac.abort(), ms)
    return ac.signal
  } catch {
    return undefined
  }
}

async function resolveTokenProgramOwner(rpcUrl: string, mint: string): Promise<string | undefined> {
  try {
    const info = await rpcCall<{ value: { owner: string } | null }>(rpcUrl, 'getAccountInfo', [mint, { encoding: 'base64', commitment: 'confirmed' }])
    const owner = info?.value?.owner
    return owner || undefined
  } catch {
    return undefined
  }
}

async function getLargestAccounts(rpcUrl: string, mint: string, programId?: string) {
  try {
    if (programId) {
      return await rpcCall<{ value: TokenLargestAccount[] }>(rpcUrl, 'getTokenLargestAccounts', [mint, { programId, commitment: 'confirmed' }])
    }
    // First try without programId (default SPL Token program)
    return await rpcCall<{ value: TokenLargestAccount[] }>(rpcUrl, 'getTokenLargestAccounts', [mint, { commitment: 'confirmed' }])
  } catch (e: any) {
    // If we failed without programId, and we didn't have one, try to resolve and retry once.
    if (!programId && /could not find mint/i.test(e?.message || '')) {
      const owner = await resolveTokenProgramOwner(rpcUrl, mint)
      if (owner) {
        return await rpcCall<{ value: TokenLargestAccount[] }>(rpcUrl, 'getTokenLargestAccounts', [mint, { programId: owner, commitment: 'confirmed' }])
      }
    }
    throw e
  }
}
