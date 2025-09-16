"use client"

import { useEffect, useMemo, useState } from 'react'
import Wheel from '@/components/Wheel'
import { shorten, formatUiAmountFixedFromRaw } from '@/lib/utils'

type Holder = {
  owner: string
  amountRaw: string
  decimals: number
  uiAmount: string
}

type HoldersResponse = {
  mint: string
  limit: number
  totalAccountsScanned?: number
  holders: Holder[]
  fetchedAt: string
  rpcUrl: string
  note?: string
  error?: string
}

export default function HomePage() {
  const [mint, setMint] = useState('6yHorJkrtdKT1u2mwAFoLP9E3xoCUp2s5kqmgMSupump')
  const [rpc, setRpc] = useState('')
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holders, setHolders] = useState<Holder[]>([])
  const [winner, setWinner] = useState<Holder | null>(null)
  const [copied, setCopied] = useState(false)
  const [weighted, setWeighted] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [spinCount, setSpinCount] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [spinDurationSec, setSpinDurationSec] = useState(65)

  const labels = useMemo(() => holders.map(h => shorten(h.owner)), [holders])

  const weights = useMemo(() => {
    if (!weighted) return holders.map(() => 1)
    return holders.map(h => Number(h.uiAmount) || 0)
  }, [holders, weighted])

  async function fetchHolders(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    setWinner(null)
    if (!mint) {
      setError('Please enter a token mint address.')
      return
    }
    try {
      setLoading(true)
      const url = new URL('/api/holders', window.location.origin)
      url.searchParams.set('mint', mint)
      url.searchParams.set('limit', String(limit))
      if (rpc) url.searchParams.set('rpc', rpc)
      const res = await fetch(url.toString())
      const data: HoldersResponse = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch holders')
      setHolders(data.holders)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch holders')
      setHolders([])
    } finally {
      setLoading(false)
    }
  }

  function pickIndexWeighted(weights: number[]) {
    const total = weights.reduce((a, b) => a + b, 0)
    if (total <= 0) return Math.floor(Math.random() * weights.length)
    let r = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      if (r < weights[i]) return i
      r -= weights[i]
    }
    return weights.length - 1
  }

  function onSpinEnd(index: number) {
    setWinner(holders[index])
  }

  function triggerSpin() {
    if (!holders.length) return
    const idx = pickIndexWeighted(weights)
    setSelectedIndex(idx)
    setWinner(null)
    setSpinCount((c) => c + 1)
    setSpinning(true)
  }

  useEffect(() => {
    // Auto-fetch on first load with preset mint
    // Triggered only once if a mint preset exists.
    if (mint && holders.length === 0 && !loading) {
      // fire and forget
      fetchHolders().then(() => {
        // after holders load, auto-trigger a spin
        setTimeout(triggerSpin, 100)
      })
    }
  }, [])

  return (
    <main className="container">
      <header className="header">
        <h1>Solana Wheel of Fortune</h1>
        <p className="subtitle">Desktop-first, modern UI. Fetch top holders for a Solana token mint and spin to pick a winner.</p>
      </header>

      <section className="controls">
        <form onSubmit={fetchHolders} className="form">
          <div className="field">
            <label>Token Mint Address</label>
            <input
              type="text"
              placeholder="e.g. So11111111111111111111111111111111111111112"
              value={mint}
              onChange={(e) => setMint(e.target.value.trim())}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <details className="field" open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}>
            <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Advanced options</summary>
            <label>RPC URL (optional)</label>
            <input
              type="text"
              placeholder="Overrides server RPC, leave blank to use server .env"
              value={rpc}
              onChange={(e) => setRpc(e.target.value.trim())}
              spellCheck={false}
            />
            <label style={{ marginTop: 8 }}>Spin Duration (seconds)</label>
            <input
              type="number"
              min={5}
              max={180}
              value={spinDurationSec}
              onChange={(e) => setSpinDurationSec(Math.max(5, Math.min(180, Number(e.target.value))))}
            />
          </details>
          <div className="row">
            <div className="field small">
              <label>Top Holders</label>
              <input
                type="number"
                min={2}
                max={10}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              />
            </div>
            <div className="field small toggle">
              <label>Weight by Balance</label>
              <input
                type="checkbox"
                checked={weighted}
                onChange={(e) => setWeighted(e.target.checked)}
              />
            </div>
            <button type="submit" className="button" disabled={loading}>
              {loading ? 'Loading…' : 'Fetch Holders'}
            </button>
            <button type="button" className="button primary" onClick={triggerSpin} disabled={loading || spinning || holders.length === 0}>
              {spinning ? 'Spinning…' : 'Spin'}
            </button>
          </div>
        </form>
      </section>

      {error && <div className="error">{error}</div>}

      {holders.length > 0 && (
        <section className="wheelSection">
          <div className="wheelWrapper">
            <Wheel
              labels={labels}
              selectedIndex={selectedIndex}
              onSpinEnd={(i) => { onSpinEnd(i); setSpinning(false) }}
              onSpinStart={() => setSpinning(true)}
              spinDurationMs={Math.max(60, spinDurationSec) * 1000}
              key={labels.join('|') + ':' + spinCount}
            />
            <div className="pointer" aria-hidden>▲</div>
          </div>
          <div className="side">
            <h2>Entrants</h2>
            <ol>
              {holders.map((h, i) => (
                <li key={h.owner + i}>
                  <span className="rank">#{i + 1}</span>
                  <span className="owner" title={h.owner}>{shorten(h.owner)}</span>
                  <span className="amount">{formatUiAmountFixedFromRaw(h.amountRaw, h.decimals, 2)}</span>
                </li>
              ))}
            </ol>
            {winner && (
              <div className="winner">
                <h3>Winner</h3>
                <div className="winnerBox">
                  <code className="winnerAddr" title={winner.owner}>{shorten(winner.owner, 6)}</code>
                  <button
                    type="button"
                    className="copyBtn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(winner.owner)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1200)
                      } catch (e) {
                        // ignore
                      }
                    }}
                    aria-label="Copy winning wallet address"
                    title="Copy address"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <span className="amount">{formatUiAmountFixedFromRaw(winner.amountRaw, winner.decimals, 2)}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="footer">
        <span>Open source • MIT License</span>
        <a href="https://github.com/openpumpgames/" target="_blank" rel="noreferrer">Pump Games</a>
      </footer>
    </main>
  )
}
