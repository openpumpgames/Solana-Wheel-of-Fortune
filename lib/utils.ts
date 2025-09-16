export function shorten(addr: string, chars = 4) {
  if (!addr) return ''
  return addr.length > chars * 2 + 3
    ? `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`
    : addr
}

export function bigIntPow10(n: number): bigint {
  let r = 1n
  for (let i = 0; i < n; i++) r *= 10n
  return r
}

export function formatUiAmount(amountRaw: bigint, decimals: number): string {
  const factor = bigIntPow10(decimals)
  const whole = amountRaw / factor
  const frac = amountRaw % factor
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracStr}`
}

export function formatUiAmountFixedFromRaw(amountRawStr: string, decimals: number, places = 2): string {
  try {
    const amountRaw = BigInt(amountRawStr)
    const mul = bigIntPow10(places)
    const denom = bigIntPow10(decimals)
    const scaled = amountRaw * mul
    const q = scaled / denom
    const r = scaled % denom
    const rounded = r * 2n >= denom ? q + 1n : q
    const whole = rounded / mul
    const frac = rounded % mul
    const fracStr = frac.toString().padStart(places, '0')
    return `${whole.toString()}.${fracStr}`
  } catch {
    // Fallback to simple parse if BigInt fails
    const num = Number(amountRawStr) / Math.pow(10, decimals)
    return isFinite(num) ? num.toFixed(places) : '0.00'
  }
}
