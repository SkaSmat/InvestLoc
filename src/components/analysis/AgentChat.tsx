import { useEffect, useRef, useState } from 'react'
import { Send, Loader2, Lightbulb, TrendingUp, Calculator, Shield, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { computeNegociation } from '@/lib/negociation'
import type { AgentMessage, AgentType, DVFAnalysisResult, LMNPResult, PropertyData } from '@/types'

interface LMNPContext {
  loyer: number
  apport: number
  travaux: number
  result: LMNPResult
}

interface AgentChatProps {
  property: PropertyData
  dvf: DVFAnalysisResult
  lmnpContext: LMNPContext | null
}

// ─── Agent metadata ───────────────────────────────────────────────────────────

const AGENT_META: Record<AgentType, { label: string; icon: React.ReactNode; color: string }> = {
  marche: {
    label: 'Agent Marché',
    icon: <TrendingUp className="h-3 w-3" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  rentabilite: {
    label: 'Agent Rentabilité',
    icon: <Calculator className="h-3 w-3" />,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  risque: {
    label: 'Agent Risque & Juridique',
    icon: <Shield className="h-3 w-3" />,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
}

const SUGGESTIONS = [
  "C'est une bonne affaire selon toi ?",
  "Quel loyer faut-il pour un cash-flow positif ?",
  "Quels sont les risques fiscaux en LMNP réel ?",
  "Comment négocier ce bien efficacement ?",
  "Compare micro-BIC et régime réel pour ce bien",
  "Quelle est la tendance du marché dans ce secteur ?",
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function AgentBadge({ type }: { type: AgentType }) {
  const meta = AGENT_META[type]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${meta.color}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  )
}

function ThinkingIndicator({ agents }: { agents: AgentType[] }) {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <div className="bg-muted rounded-xl rounded-tl-sm px-3.5 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        {agents.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agents.map((a) => (
              <AgentBadge key={a} type={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: AgentMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className="space-y-1.5 max-w-[80%]">
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          }`}
        >
          {msg.content}
        </div>
        {!isUser && msg.agents && msg.agents.length > 0 && (
          <div className="flex flex-wrap gap-1 pl-1">
            {msg.agents.map((a) => (
              <AgentBadge key={a} type={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentChat({ property, dvf, lmnpContext }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeAgents, setActiveAgents] = useState<AgentType[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function buildContext() {
    const nego = computeNegociation(property, dvf)
    return {
      property: {
        title: property.title,
        price: property.price,
        surface: property.surface,
        rooms: property.rooms,
        address: property.address,
        postalCode: property.postalCode,
        city: property.city,
        condition: property.condition,
        publishedAt: property.publishedAt,
        url: property.url,
      },
      dvf: {
        mediane: dvf.mediane,
        p10: dvf.p10,
        p90: dvf.p90,
        ecartPourcent: dvf.ecartPourcent,
        nbTransactions: dvf.nbTransactions,
        tendance: dvf.tendance,
      },
      lmnp: lmnpContext
        ? {
            loyer: lmnpContext.loyer,
            apport: lmnpContext.apport,
            travaux: lmnpContext.travaux,
            rendementBrut: lmnpContext.result.rendementBrut,
            rendementNet: lmnpContext.result.rendementNet,
            prixTotal: lmnpContext.result.prixTotal,
            mensualiteCredit: lmnpContext.result.mensualiteCredit,
            microBICCashflow: lmnpContext.result.microBIC.cashflowMensuel,
            reelCashflow: lmnpContext.result.reel.cashflowMensuel,
            amortissementTotal: lmnpContext.result.amortissementTotal,
          }
        : undefined,
      negociation: {
        potentiel: nego.potentiel,
        scoreTotal: nego.scoreTotal,
        offreRecommandee: nego.offreRecommandee,
        offreBasse: nego.offreBasse,
        remisePct: nego.remisePct,
      },
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: AgentMessage = { role: 'user', content: trimmed, timestamp: Date.now() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setActiveAgents([])

    try {
      const { data, error } = await supabase.functions.invoke('agent-supervisor', {
        body: {
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          context: buildContext(),
        },
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: data.content,
        agents: data.agents ?? [],
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Erreur : ${msg}`, timestamp: Date.now() },
      ])
    } finally {
      setLoading(false)
      setActiveAgents([])
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 pb-1 border-b border-border">
        {(Object.keys(AGENT_META) as AgentType[]).map((type) => (
          <AgentBadge key={type} type={type} />
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">
          — agents mobilisés selon votre question
        </span>
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Questions fréquentes
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent hover:text-accent-foreground transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message feed */}
      {messages.length > 0 && (
        <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {loading && <ThinkingIndicator agents={activeAgents} />}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Posez une question sur ce bien… (Entrée pour envoyer)"
          className="resize-none min-h-[44px] max-h-32"
          rows={1}
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Shift+Entrée pour aller à la ligne · Le contexte complet de l'analyse est injecté
      </p>
    </div>
  )
}
