import type { ReactNode } from 'react'
import './globals.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Solana Wheel of Fortune</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="A desktop-first, modern Wheel of Fortune that selects a random wallet among top holders of a Solana token mint." />
      </head>
      <body>{children}</body>
    </html>
  )
}

