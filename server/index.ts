/**
 * Onchain Agent — x402 Gateway Nanopayments backend
 * Exposes /api/agent (paid, $0.01/call) and /api/agent/status (free).
 */
import express from 'express'
import cors from 'cors'
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'

const app = express()
app.use(cors())
app.use(express.json())

// The address that receives USDC settlement from Circle Gateway.
// Set VITE_SELLER_ADDRESS in .env — VITE_ prefix so the frontend can display it too.
const sellerAddress = process.env.VITE_SELLER_ADDRESS as `0x${string}` | undefined

if (!sellerAddress) {
  console.warn(
    '[agent-server] VITE_SELLER_ADDRESS is not set — paid endpoint will reject all requests.',
  )
}

const gateway = createGatewayMiddleware({
  sellerAddress: sellerAddress ?? '0x0000000000000000000000000000000000000000',
})

// ── Free endpoint ────────────────────────────────────────────────────────────
app.get('/api/agent/status', (_req, res) => {
  res.json({
    status: 'online',
    name: process.env.VITE_AGENT_NAME ?? 'Arc Agent',
    version: '1.0.0',
    x402Support: true,
    paidEndpoint: '/api/agent',
    pricePerCall: '$0.01 USDC',
  })
})

// ── Paid endpoint — $0.01 per call ──────────────────────────────────────────
app.post('/api/agent', gateway.require('$0.01'), async (req, res) => {
  const { prompt } = req.body as { prompt?: string }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }
  // Simulated agent response (replace with real LLM call)
  res.json({
    response: `[Agent processed]: "${prompt.trim()}" — answered at ${new Date().toISOString()}`,
    billedUsdc: '0.01',
    seller: sellerAddress,
  })
})

const PORT = Number(process.env.PORT ?? 3001)
app.listen(PORT, () => {
  console.log(`[agent-server] listening on http://localhost:${PORT}`)
  console.log(`[agent-server] seller address: ${sellerAddress ?? '(not set)'}`)
})
