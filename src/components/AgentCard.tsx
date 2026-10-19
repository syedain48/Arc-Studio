/**
 * AgentCard — ERC-8004 identity registration and live identity display.
 */
import { useState } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useReadContract,
} from 'wagmi'
import { parseEventLogs } from 'viem'
import { Bot, ExternalLink, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { arcTestnet } from 'viem/chains'
import { buildTxExplorerUrl } from '@/onchain-facts'

const ARC_TESTNET_ID = arcTestnet.id

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

const identityAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const

interface Props {
  agentName: string
  agentDescription: string
  sellerAddress: string
  onRegistered: (agentId: bigint) => void
  registeredAgentId: bigint | null
}

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

function fmt(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function AgentCard({
  agentName,
  agentDescription,
  sellerAddress,
  onRegistered,
  registeredAgentId,
}: Props) {
  const { address, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = !!chainId && chainId !== ARC_TESTNET_ID

  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash })

  // Read live owner once we have a registration
  const { data: ownerOf } = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: identityAbi,
    functionName: 'ownerOf',
    args: registeredAgentId !== null ? [registeredAgentId] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: registeredAgentId !== null },
  })

  const [localError, setLocalError] = useState<string | null>(null)

  // Parse agentId from receipt logs once confirmed
  if (isSuccess && receipt && registeredAgentId === null) {
    try {
      const [ev] = parseEventLogs({ abi: identityAbi, eventName: 'Registered', logs: receipt.logs })
      if (ev) onRegistered(ev.args.agentId)
    } catch {
      // already handled by onRegistered call guard
    }
  }

  function buildAgentURI() {
    const base = window.location.origin
    const card = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: agentName,
      description: agentDescription,
      services: [
        {
          name: 'PaidAgent',
          endpoint: `${base}/api/agent`,
          version: '1.0.0',
        },
      ],
      x402Support: true,
      active: true,
    }
    // Encode as data URI so it's self-contained (production: upload to IPFS/HTTPS)
    return 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(card))
  }

  function handleRegister() {
    setLocalError(null)
    if (!address) return
    if (wrongChain) {
      switchChain({ chainId: ARC_TESTNET_ID })
      return
    }
    try {
      writeContract({
        address: IDENTITY_REGISTRY,
        abi: identityAbi,
        functionName: 'register',
        args: [buildAgentURI()],
        chainId: ARC_TESTNET_ID,
      })
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const txUrl = txHash ? buildTxExplorerUrl(ARC_TESTNET_ID, txHash) : null
  const explorerAgentUrl =
    registeredAgentId !== null
      ? `https://explorer.testnet.arc.io/address/${IDENTITY_REGISTRY}`
      : null

  return (
    <section className="rounded-3xl p-5" style={glass.card}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(18,45,69,0.08)' }}
        >
          <Bot className="size-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 className="display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
            {agentName}
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            ERC-8004 Identity · Arc Testnet
          </p>
        </div>
      </div>

      {/* Agent info rows */}
      <div className="mb-4 space-y-2 rounded-2xl p-3" style={glass.inner}>
        <Row label="Description" value={agentDescription} />
        <Row label="Seller address" value={sellerAddress ? fmt(sellerAddress) : 'Not set'} mono />
        <Row label="Registry" value={fmt(IDENTITY_REGISTRY)} mono />
        {registeredAgentId !== null && (
          <>
            <Row label="Agent ID" value={`#${registeredAgentId.toString()}`} />
            <Row label="Owner" value={ownerOf ? fmt(ownerOf) : '…'} mono />
          </>
        )}
      </div>

      {/* Status / success */}
      {registeredAgentId !== null ? (
        <div className="mb-3 flex items-center gap-2 rounded-2xl p-3" style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.18)' }}>
          <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
              Registered as Agent #{registeredAgentId.toString()}
            </p>
            {explorerAgentUrl && (
              <a
                href={explorerAgentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-xs"
                style={{ color: 'var(--accent-hover)' }}
              >
                View registry <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      ) : txUrl && isSuccess ? null : null}

      {/* TX receipt (pre-agentId parse) */}
      {txHash && !registeredAgentId && (
        <div className="mb-3 rounded-2xl p-3" style={{ background: 'rgba(18,45,69,0.05)', border: '1px solid var(--border)' }}>
          {isConfirming ? (
            <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Loader2 className="size-3 animate-spin" /> Confirming on Arc Testnet…
            </p>
          ) : isSuccess ? (
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                Transaction confirmed
              </p>
              <a
                href={txUrl!}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-xs"
                style={{ color: 'var(--accent-hover)' }}
              >
                View on ArcScan <ExternalLink className="size-3" />
              </a>
            </div>
          ) : null}
        </div>
      )}

      {/* Error */}
      {(writeError ?? localError) && (
        <div className="mb-3 flex items-start gap-2 rounded-2xl p-3" style={{ background: 'rgba(186,43,76,0.08)', border: '1px solid rgba(186,43,76,0.18)' }}>
          <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            {writeError?.message?.includes('user rejected')
              ? 'Transaction cancelled.'
              : (writeError?.message ?? localError ?? 'Unknown error')}
          </p>
          <button onClick={reset} className="ml-auto text-xs underline" style={{ color: 'var(--danger)' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* CTA */}
      {registeredAgentId === null && (
        <button
          disabled={!address || isPending || isConfirming || isSwitching}
          onClick={handleRegister}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
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
            : 'Register Agent Identity'}
        </button>
      )}
    </section>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span
        className={`text-xs font-medium tabular-nums ${mono ? 'mono' : ''}`}
        style={{ color: 'var(--ink-2)' }}
      >
        {value}
      </span>
    </div>
  )
}
