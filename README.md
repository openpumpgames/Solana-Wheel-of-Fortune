# Solana Wheel of Fortune

Desktop‑first, modern “Wheel of Fortune” built with Next.js and React. It fetches top token holders for a given Solana token mint (via a public RPC), displays them on a wheel, and spins to pick a random winner. Open source and easy to run.

DEMO:
https://solana-wheel-of-fortune.vercel.app/

TOKEN:
7Cw2wFW6nAWpnDuym74NMXxw6Pn1sk29ZC2wNybJuVta

## Features

- Desktop‑first, responsive UI with a clean, modern style.
- API route `/api/holders` that fetches top holders from a Solana RPC.
- Uses `getTokenLargestAccounts` + `getMultipleAccounts` to map token accounts → owner wallets.
- Aggregates balances per owner and returns the top N holders (default 10).
- Client UI to input token mint and optional RPC override.
- Spin the wheel to select a winner; shows the winning wallet address.
- Optional “Weight by Balance” toggle to bias selection by holder’s balance.

## Quick Start

1. Install dependencies:

   - `npm install`

2. Configure RPC (optional):

   - Copy `.env.example` to `.env` and set `SOLANA_RPC_URL` if you want a custom RPC (Ankr, Helius, etc.). The default is `https://api.mainnet-beta.solana.com`.

3. Run the dev server:

   - `npm run dev`

4. Open `http://localhost:3000` and:

   - Paste a token mint address.
   - Set Top Holders (2–10) and optionally toggle “Weight by Balance”.
   - Click “Fetch Holders” then spin the wheel.

## How It Works

The server API performs two lightweight RPC calls:

1. `getTokenLargestAccounts(mint)` to fetch the largest token accounts for the mint.
2. `getMultipleAccounts(addresses, { encoding: 'jsonParsed' })` to resolve the owner of each token account.

It then aggregates balances by owner and returns the top N owners. This is fast and works well for most tokens. Note that it’s an approximation when a large holder splits balance across many smaller accounts that don’t all appear among the largest accounts. For heavy on‑chain analytics across all accounts, use an indexer or dedicated service.

### API

- `GET /api/holders?mint=<MINT>&limit=<N>&rpc=<URL>`
  - `mint` (required): SPL token mint address.
  - `limit` (optional): 2–10 (defaults to 10).
  - `rpc` (optional): Override server RPC URL for this request.
  - Response:
    ```json
    {
      "mint": "...",
      "limit": 10,
      "holders": [
        { "owner": "...", "amountRaw": "123000000", "decimals": 6, "uiAmount": "123" }
      ],
      "fetchedAt": "2025-09-16T00:00:00.000Z",
      "rpcUrl": "https://...",
      "note": "Owners aggregated from top token accounts..."
    }
    ```

## Design Notes

- Desktop‑first layout prioritizes a large spinning wheel with a side panel for entrants and results.
- The wheel renders equal slices for top holders. If “Weight by Balance” is enabled, selection probability is weighted, but the visual slices remain equal for clarity and simplicity.
- All copy/UI is written in English as requested.

## Open Source

This project is open source under the MIT License. Contributions are welcome via pull requests.

## Roadmap Ideas

- Option to persist spin history with timestamps.
- Provably‑fair commit‑reveal scheme for selection.
- Fully weighted wheel visualization (variable slice sizes).
- Predefined mint presets and network switcher (mainnet/testnet/devnet).

## Disclaimer

This tool is for demonstration and community use. Do your own research and use a reliable RPC for production.

## Troubleshooting

- Dev cache error (e.g., “Cannot find module './948.js'”):
  - Stop the dev server, then run: `npm run clean && npm run dev`
  - If it persists: `rm -rf node_modules package-lock.json && npm install && npm run dev`
  - Alternatively, run production: `npm run build && npm start`
  - Ensure Node.js is >= 18.17.
