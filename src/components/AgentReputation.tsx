/**
 * AgentReputation — give on-chain feedback (ERC-8004 ReputationRegistry) and read summary.
 */
import { useState } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useReadContract,
} from 'wagmi'
import { keccak256, toBytes } from 'viem'
import { Star, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { arcTestnet } from 'viem/chains'
import { buildTxExplorerUrl } from '@/onchain-facts'

const ARC_TESTNET_ID = arcTestnet.id

const REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const

const reputationAbi = [
  {
    type: 'function',
    name: 'giveFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const

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

interface Props {
  agentId: bigint | null
}

export function AgentReputation({ agentId }: Props) {
  const { address, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = !!chainId && chainId !== ARC_TESTNET_ID

  const [score, setScore] = useState(85)
  const [tag, setTag] = useState('api-call')

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Fetch client list for summary
  const { data: clients } = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getClients',
    args: agentId !== null ? [agentId] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: agentId !== null, refetchInterval: 8000 },
  })

  // Summary — only query when there is at least one client
  const { data: summary, refetch: refetchSummary } = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getSummary',
    args:
      agentId !== null && clients && clients.length > 0
        ? [agentId, clients, '', '']
        : undefined,
    chainId: ARC_TESTNET_ID,
    query: {
      enabled: agentId !== null && !!clients && clients.length > 0,
      refetchInterval: 8000,
    },
  })

  function handleFeedback() {
    if (!address || agentId === null) return
    if (wrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    const body = JSON.stringify({ score, tag })
    writeContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: 'giveFeedback',
      args: [
        agentId,
        BigInt(score),
        0,
        tag,
        '',
        '/api/agent',
        '',
        keccak256(toBytes(body)),
      ],
      chainId: ARC_TESTNET_ID,
    })
  }

  const txUrl = txHash ? buildTxExplorerUrl(ARC_TESTNET_ID, txHash) : null

  const [count, summaryValue] = summary
    ? [Number(summary[0]), Number(summary[1])]
    : [0, 0]

  if (agentId === null) {
    return (
      <section className="rounded-3xl p-5" style={glass.card}>
        <h3 className="display mb-2 text-base font-semibold" style={{ color: 'var(--ink)' }}>
          Reputation
        </h3>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Register the agent first to submit and read reputation.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      <div className="mb-4 flex items-center gap-2">
        <Star className="size-4" style={{ color: 'var(--accent)' }} />
        <h3 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>
          Reputation · Agent #{agentId.toString()}
        </h3>
      </div>

      {/* Live summary */}
      <div className="mb-4 rounded-2xl p-3" style={glass.inner}>
        {count > 0 ? (
          <div className="flex items-baseline gap-2">
            <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {summaryValue}
            </span>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>
              avg score · {count} {count === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            No feedback yet. Be the first to rate this agent.
          </p>
        )}
      </div>

      {/* Give feedback form */}
      <div className="mb-3 space-y-3 rounded-2xl p-3" style={glass.inner}>
        <p className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
          Give Feedback
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            Score (0-100)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Math.min(100, Math.max(0, Number(e.target.value))))}
            className="w-20 rounded-lg border px-2 py-1 text-sm tabular-nums"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--ink)',
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs" style={{ color: 'var(--muted)' }}>
            Tag
          </label>
          <input
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value.trim().slice(0, 32))}
            placeholder="e.g. api-call"
            className="flex-1 rounded-lg border px-2 py-1 text-sm"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--ink)',
            }}
          />
        </div>
      </div>

      {/* TX result */}
      {txHash && (
        <div className="mb-3 rounded-2xl p-3" style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid var(--border)' }}>
          {isConfirming ? (
            <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Loader2 className="size-3 animate-spin" /> Submitting feedback…
            </p>
          ) : isSuccess ? (
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                Feedback recorded
              </p>
              <button
                onClick={() => { void refetchSummary() }}
                className="mt-0.5 text-xs underline"
                style={{ color: 'var(--accent-hover)' }}
              >
                Refresh summary
              </button>
              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 inline-flex items-center gap-1 text-xs"
                  style={{ color: 'var(--accent-hover)' }}
                >
                  ArcScan <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ) : null}
        </div>
      )}

      {writeError && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl p-3" style={{ background: 'rgba(186,43,76,0.08)', border: '1px solid rgba(186,43,76,0.18)' }}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {writeError.message.includes('user rejected')
              ? 'Transaction cancelled.'
              : writeError.message}
          </p>
          <button onClick={reset} className="ml-auto text-xs underline" style={{ color: 'var(--danger)' }}>
            Dismiss
          </button>
        </div>
      )}

      <button
        disabled={!address || isPending || isConfirming || isSwitching || !tag}
        onClick={handleFeedback}
        className="w-full rounded-2xl py-3 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
      >
        {!address
          ? 'Connect Wallet'
          : wrongChain || isSwitching
          ? 'Switch to Arc Testnet'
          : isPending
          ? (<span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>)
          : isConfirming
          ? (<span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirming…</span>)
          : 'Submit Feedback'}
      </button>
    </section>
  )
}
