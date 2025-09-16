#!/usr/bin/env node
// Lightweight probe to fetch top holders for a mint via RPC without Next.js.
// Usage: node scripts/probe-holders.mjs --mint <MINT> [--limit 10] [--rpc <URL>]

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'])
  return acc
}, []))

const mint = (args.mint || '').trim()
const limit = Math.min(Math.max(Number(args.limit || 10), 2), 10)
const rpcUrl = (args.rpc || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com').trim()

if (!mint) {
  console.error('Missing --mint')
  process.exit(1)
}

;(async () => {
  try {
    const programOwner = await resolveTokenProgramOwner(rpcUrl, mint)
    const largestRes = await getLargestAccounts(rpcUrl, mint, programOwner)
    const largest = largestRes?.value || []
    const decimals = largest[0]?.decimals ?? 0
    const tokenAccountAddrs = largest.slice(0, 30).map((x) => x.address)
    const parsedRes = await rpcCall(rpcUrl, 'getMultipleAccounts', [tokenAccountAddrs, { encoding: 'jsonParsed', commitment: 'confirmed' }])
    const parsedOwners = {}
    parsedRes.value.forEach((acc, i) => {
      const addr = tokenAccountAddrs[i]
      const owner = acc?.data?.parsed?.info?.owner
      if (addr && owner) parsedOwners[addr] = owner
    })
    const byOwner = new Map()
    for (const item of largest) {
      const owner = parsedOwners[item.address]
      if (!owner) continue
      const amt = BigInt(item.amount)
      byOwner.set(owner, (byOwner.get(owner) || 0n) + amt)
    }
    const ranked = [...byOwner.entries()]
      .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
      .slice(0, limit)
    const holders = ranked.map(([owner, amountRaw]) => ({
      owner,
      amountRaw: amountRaw.toString(),
      decimals,
      uiAmount: formatUiAmount(amountRaw, decimals),
    }))
    console.log(JSON.stringify({ mint, limit, holders, rpcUrl }, null, 2))
  } catch (e) {
    console.error('Probe error:', e?.message || e)
    process.exit(2)
  }
})()

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'probe', method, params }),
    signal: timeoutSignal(20000),
  })
  if (!res.ok) throw new Error(`RPC HTTP error: ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error?.message || 'RPC error')
  return json.result
}

async function resolveTokenProgramOwner(rpcUrl, mint) {
  const info = await rpcCall(rpcUrl, 'getAccountInfo', [mint, { encoding: 'jsonParsed', commitment: 'confirmed' }])
  return info?.value?.owner
}

async function getLargestAccounts(rpcUrl, mint, programId) {
  try {
    if (programId) return await rpcCall(rpcUrl, 'getTokenLargestAccounts', [mint, { programId, commitment: 'confirmed' }])
    return await rpcCall(rpcUrl, 'getTokenLargestAccounts', [mint, { commitment: 'confirmed' }])
  } catch (e) {
    if (!programId && /could not find mint/i.test(e?.message || '')) {
      const owner = await resolveTokenProgramOwner(rpcUrl, mint)
      if (owner) return await rpcCall(rpcUrl, 'getTokenLargestAccounts', [mint, { programId: owner }])
    }
    throw e
  }
}

function bigIntPow10(n) {
  let r = 1n
  for (let i = 0; i < n; i++) r *= 10n
  return r
}

function formatUiAmount(amountRaw, decimals) {
  const factor = bigIntPow10(decimals)
  const whole = amountRaw / factor
  const frac = amountRaw % factor
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracStr}`
}

function timeoutSignal(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms)
    }
  } catch {}
  try {
    const ac = new AbortController()
    setTimeout(() => ac.abort(), ms)
    return ac.signal
  } catch {
    return undefined
  }
}
