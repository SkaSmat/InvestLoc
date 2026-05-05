import { useEffect, useRef, useState } from 'react'
import { Send, Bot, User, Loader2, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { computeNegociation } from '@/lib/negociation'
import type { DVFAnalysisResult, LMNPResult, PropertyData } from '@/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface LMNPContext {
  loyer: number
  apport: number
  travaux: number
  result: LMNPResult
}

interface ChatSectionProps {
  property: PropertyData
  dvf: DVFAnalysisResult
  lmnpContext: LMNPContext | null
}

const SUGGESTIONS = [
  'Et si je mets 30 000 € d\'apport ?',
  'C\'est une bonne affaire selon toi ?',
  'Rédige-moi l\'argumentaire de négociation',
  'Quel loyer faut-il pour avoir un cash-flow positif ?',
  'Compare micro-BIC et régime réel pour ce bien',
]

function MessageBubble({ msg }: { msg: ChatMessage }) {
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
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

export function ChatSection({ property, dvf, lmnpContext }: ChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('chat-analysis', {
        body: {
          messages: nextMessages,
          context: buildContext(),
        },
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau'
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Erreur : ${msg}` },
      ])
    } finally {
      setLoading(false)
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
      {/* Suggestions initiales */}
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

      {/* Fil de messages */}
      {messages.length > 0 && (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {loading && (
            <div className="flex gap-2.5">
              <div className="shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
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
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Shift+Entrée pour aller à la ligne · Le contexte complet de l'analyse est injecté
      </p>
    </div>
  )
}
