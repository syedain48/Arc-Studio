import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useReadContract } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { erc20Abi } from 'viem'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { getUsdc } from '@/onchain-facts'
import { AgentCard } from './components/AgentCard'
import { AgentReputation } from './components/AgentReputation'
import { AgentPayment } from './components/AgentPayment'

const ARC_TESTNET_ID = arcTestnet.id
const USDC_FACT = getUsdc(ARC_TESTNET_ID)

const AGENT_NAME: string = String(import.meta.env.VITE_AGENT_NAME ?? 'Arc Agent')
const AGENT_DESC: string = String(import.meta.env.VITE_AGENT_DESCRIPTION ?? 'A pay-per-call agent with ERC-8004 identity on Arc Testnet')
const SELLER_ADDRESS: string = String(import.meta.env.VITE_SELLER_ADDRESS ?? '')

export default function App() {
  const { address } = useAccount()
  const [registeredAgentId, setRegisteredAgentId] = useState<bigint | null>(null)

  const { data: rawBalance } = useReadContract({
    address: USDC_FACT?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!USDC_FACT, refetchInterval: 10000 },
  })

  const formattedBalance = rawBalance != null
    ? Amount.fromRaw(rawBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : null

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Topbar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-5 py-3"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="display text-base font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            Arc Agent
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--muted)' }}
          >
            ERC-8004 + x402
          </span>
        </div>
        <div className="flex items-center gap-3">
          {address && formattedBalance !== null && (
            <span
              className="tabular-nums text-sm font-semibold"
              style={{ color: 'var(--ink-2)' }}
            >
              {formattedBalance} USDC
            </span>
          )}
          <ConnectKitButton />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {/* Hero label */}
        <div className="pt-1 pb-2">
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
            {AGENT_NAME}
          </h1>
          <p className="mt-1 text-sm text-pretty" style={{ color: 'var(--muted)' }}>
            {AGENT_DESC}
          </p>
        </div>

        {/* Identity registration */}
        <AgentCard
          agentName={AGENT_NAME}
          agentDescription={AGENT_DESC}
          sellerAddress={SELLER_ADDRESS}
          onRegistered={setRegisteredAgentId}
          registeredAgentId={registeredAgentId}
        />

        {/* x402 paid endpoint */}
        <AgentPayment />

        {/* Reputation */}
        <AgentReputation agentId={registeredAgentId} />

        {/* Faucet hint */}
        {!address && (
          <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
            Connect your wallet, then use "Get test USDC" in the Arc Studio sidebar to fund it.
          </p>
        )}
      </main>
    </div>
  )
}
