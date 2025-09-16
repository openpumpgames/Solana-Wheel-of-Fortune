"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  labels: string[]
  selectedIndex: number
  onSpinEnd?: (index: number) => void
  onSpinStart?: () => void
  spinDurationMs?: number
}

export default function Wheel({ labels, selectedIndex, onSpinEnd, onSpinStart, spinDurationMs }: Props) {
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const colors = useMemo(() => makeColors(labels.length), [labels.length])

  useEffect(() => {
    if (!labels.length) return
    // Trigger spin to selectedIndex by calculating target rotation.
    const duration = typeof spinDurationMs === 'number' ? Math.max(spinDurationMs, 61000) : 65000
    const target = computeTargetRotation(labels.length, selectedIndex)
    // Scale turns with duration so long spins remain visually engaging.
    const turnsPerSec = 1.4 + Math.random() * 0.4 // ~1.4–1.8 tps
    const extraTurns = Math.max(10, Math.ceil((duration / 1000) * turnsPerSec))
    const targetRotation = target + extraTurns * 360
    setSpinning(true)
    onSpinStart?.()
    // Defer to ensure CSS transition picks up
    const id = setTimeout(() => setRotation(prev => prev + targetRotation), 20)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels.join('|'), selectedIndex])

  function handleTransitionEnd() {
    setSpinning(false)
    const index = getIndexFromRotation(rotation, labels.length)
    onSpinEnd?.(index)
  }

  return (
    <div
      ref={ref}
      className="wheel"
      style={{
        width: 560,
        height: 560,
        borderRadius: '50%',
        border: '10px solid #25336b',
        position: 'relative',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        transform: `rotate(${rotation}deg)`,
        transition: spinning ? `transform ${(typeof spinDurationMs === 'number' ? Math.max(spinDurationMs, 61000) : 65000) / 1000}s cubic-bezier(0.21, 0.01, 0.01, 1)` : undefined,
        background: '#0f152b',
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {labels.map((label, i) => (
        <Slice key={i} index={i} count={labels.length} color={colors[i]} label={label} />
      ))}
      <div style={{
        position: 'absolute', inset: 10, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.08)'
      }} />
      <CenterButton spinning={spinning} />
    </div>
  )
}

function Slice({ index, count, color, label }: { index: number, count: number, color: string, label: string }) {
  const angle = 360 / count
  const rotate = angle * index
  const skewY = 90 - angle
  return (
    <div style={{
      position: 'absolute',
      width: '50%',
      height: '50%',
      left: '50%',
      top: '50%',
      transformOrigin: '0% 0%',
      transform: `rotate(${rotate}deg) skewY(${skewY}deg)`,
      background: color,
      borderRight: '1px solid rgba(0,0,0,0.2)',
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{
        transform: `skewY(-${skewY}deg) rotate(${angle / 2}deg) translate(-10%, -140%)`,
        transformOrigin: '50% 50%',
        color: 'white',
        textShadow: '0 2px 6px rgba(0,0,0,0.6)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        fontSize: 14,
      }}>{label}</div>
    </div>
  )
}

function CenterButton({ spinning }: { spinning: boolean }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 'calc(50% - 40px)',
      width: 80,
      height: 80,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 30% 30%, #b5c7ff, #6ea8fe 60%, #3d61ff)',
      boxShadow: '0 10px 24px rgba(62, 87, 255, 0.6), inset 0 2px 6px rgba(255,255,255,0.4)',
      border: '4px solid #22306b',
      display: 'grid',
      placeItems: 'center',
      color: '#0b1020',
      fontWeight: 800,
    }}>
      {spinning ? '...' : 'SPIN'}
    </div>
  )
}

function makeColors(n: number) {
  const base = [
    '#3a6df0', '#7b61ff', '#4cc9f0', '#4895ef', '#56cfe1', '#6ee7b7',
    '#f59e0b', '#ef4444', '#ec4899', '#10b981', '#14b8a6'
  ]
  const colors: string[] = []
  for (let i = 0; i < n; i++) colors.push(base[i % base.length])
  return colors
}

function computeTargetRotation(count: number, index: number) {
  const anglePer = 360 / count
  // Need to land with the slice center at the pointer (top). The slice starts at index*angle, its center is + angle/2.
  const targetAngle = 360 - (index * anglePer + anglePer / 2)
  return targetAngle
}

function getIndexFromRotation(rotationDeg: number, count: number) {
  const norm = ((rotationDeg % 360) + 360) % 360
  const anglePer = 360 / count
  const angleFromTop = (360 - norm)
  let index = Math.floor((angleFromTop + anglePer / 2) / anglePer) % count
  if (index < 0) index += count
  return index
}
