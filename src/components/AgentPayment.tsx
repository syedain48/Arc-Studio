/**
 * AgentPayment — x402 pay-per-call panel.
 * Demonstrates calling the paid /api/agent endpoint.
 * In-browser we call a local proxy route; the backend handles x402 negotiation.
 * NOTE: In production the buyer wallet (Circle agent wallet / x402-enabled client)
 * would automatically attach the Payment header. In this demo the user sees
 * the 402 flow described and can trigger the call.
 */
import { useState } from 'react'
import { Zap, Loader2, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid var(--border)',
  } as React.CSSProperties,
  inner: {
    background: 'var(--surface-muted)',
    border: '1px solid var(--border)',
  } as React.CSSProperties,
}

interface AgentResponse {
  response: string
  billedUsdc: string
  seller?: string
}

interface PaymentState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'unpaid'
  result?: AgentResponse
  error?: string
  requires402?: {
    amount: string
    network: string
  }
}

export function AgentPayment() {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<PaymentState>({ status: 'idle' })

  async function callAgent() {
    if (!prompt.trim()) return
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (res.status === 402) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        const accepts = Array.isArray(body.accepts) ? body.accepts : []
        const first = accepts[0] as { maxAmountRequired?: string; network?: string } | undefined
        setState({
          status: 'unpaid',
          requires402: {
            amount: first?.maxAmountRequired ?? '0.01',
            network: first?.network ?? 'Arc Testnet',
          },
        })
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Server error' })) as { error?: string }
        setState({ status: 'error', error: body.error ?? `HTTP ${res.status}` })
        return
      }

      const data = await res.json() as AgentResponse
      setState({ status: 'success', result: data })
    } catch (e: unknown) {
      setState({ status: 'error', error: e instanceof Error ? e.message : 'Network error' })
    }
  }

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      <div className="mb-4 flex items-center gap-2">
        <Zap className="size-4" style={{ color: 'var(--accent)' }} />
        <h3 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>
          x402 Pay-per-Call
        </h3>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--muted)' }}
        >
          $0.01 / call
        </span>
      </div>

      {/* Info rows */}
      <div className="mb-4 space-y-2 rounded-2xl p-3 text-xs" style={glass.inner}>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Endpoint</span>
          <span className="mono font-medium" style={{ color: 'var(--ink-2)' }}>
            POST /api/agent
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Protocol</span>
          <span className="font-medium" style={{ color: 'var(--ink-2)' }}>
            HTTP 402 · Circle Gateway
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Payment asset</span>
          <span className="font-medium" style={{ color: 'var(--ink-2)' }}>
            USDC · Arc Testnet
          </span>
        </div>
      </div>

      {/* Prompt input */}
      <div className="mb-3 rounded-2xl p-3" style={glass.inner}>
        <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the agent something…"
          rows={2}
          className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--ink)',
          }}
        />
      </div>

      {/* Result states */}
      {state.status === 'success' && state.result && (
        <div
          className="mb-3 rounded-2xl p-3"
          style={{ background: 'rgba(26,128,71,0.06)', border: '1px solid rgba(26,128,71,0.18)' }}
        >
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--success)' }}>
            <CheckCircle2 className="size-4" />
            Paid · ${state.result.billedUsdc} USDC
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--ink-2)' }}>
            {state.result.response}
          </p>
        </div>
      )}

      {state.status === 'unpaid' && state.requires402 && (
        <div
          className="mb-3 rounded-2xl p-3"
          style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.18)' }}
        >
          <p className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--danger)' }}>
            <AlertCircle className="size-4" />
            HTTP 402 — Payment Required
          </p>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
            Amount: <span className="mono font-semibold">{state.requires402.amount} USDC</span>
            {' '}on {state.requires402.network}.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            A Circle agent wallet with Gateway balance will attach the payment header automatically.
          </p>
          <a
            href="https://developers.circle.com/gateway/nanopayments"
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--accent-hover)' }}
          >
            Circle Gateway docs <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {state.status === 'error' && (
        <div
          className="mb-3 flex items-start gap-2 rounded-2xl p-3"
          style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.18)' }}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {state.error}
          </p>
        </div>
      )}

      <button
        disabled={!prompt.trim() || state.status === 'loading'}
        onClick={() => { void callAgent() }}
        className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
      >
        {state.status === 'loading'
          ? (<span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Calling agent…</span>)
          : 'Call Agent (x402)'}
      </button>

      <p className="mt-2 text-center text-xs" style={{ color: 'var(--subtle)' }}>
        Without a Circle agent wallet the server returns HTTP 402. Set{' '}
        <span className="mono">VITE_SELLER_ADDRESS</span> and fund a Gateway wallet to enable paid calls.
      </p>
    </section>
  )
}
