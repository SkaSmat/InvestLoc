// Supabase Edge Function — Deno runtime
// Chat conversationnel avec contexte de l'analyse courante injecté dans le system prompt.
// ANTHROPIC_API_KEY stockée en secret Supabase.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnalysisContext {
  property: {
    title: string
    price: number
    surface: number
    rooms: number
    address: string
    postalCode: string
    city: string
    condition: string
    publishedAt: string | null
    url: string
  }
  dvf: {
    mediane: number
    p10: number
    p90: number
    ecartPourcent: number
    nbTransactions: number
    tendance: number
  }
  lmnp?: {
    loyer: number
    apport: number
    travaux: number
    rendementBrut: number
    rendementNet: number
    prixTotal: number
    mensualiteCredit: number
    microBICCashflow: number
    reelCashflow: number
    amortissementTotal: number
  }
  negociation?: {
    potentiel: string
    scoreTotal: number
    offreRecommandee: number
    offreBasse: number
    remisePct: number
  }
}

function buildSystemPrompt(ctx: AnalysisContext): string {
  const { property, dvf, lmnp, negociation } = ctx
  const prixM2 = Math.round(property.price / property.surface)
  const jours = property.publishedAt
    ? Math.floor((Date.now() - new Date(property.publishedAt).getTime()) / 86400000)
    : null

  const conditionMap: Record<string, string> = {
    neuf: 'neuf / rénové',
    bon: 'bon état',
    moyen: 'état moyen',
    travaux: 'travaux à prévoir',
  }

  let prompt = `Tu es ImmoAgent, un expert en investissement immobilier locatif LMNP meublé en Île-de-France.
Tu analyses actuellement ce bien et tu aides l'investisseur à prendre sa décision.

═══ BIEN ANALYSÉ ═══
Titre       : ${property.title}
Prix FAI    : ${property.price.toLocaleString('fr-FR')} € (${prixM2.toLocaleString('fr-FR')} €/m²)
Surface     : ${property.surface} m² — ${property.rooms} pièce${property.rooms > 1 ? 's' : ''}
Localisation: ${property.address}, ${property.postalCode} ${property.city}
État        : ${conditionMap[property.condition] ?? property.condition}
${jours !== null ? `En ligne depuis : ${jours} jours` : ''}
URL annonce : ${property.url}

═══ MARCHÉ DVF ═══
Médiane marché : ${dvf.mediane.toLocaleString('fr-FR')} €/m²
Fourchette     : P10 ${dvf.p10.toLocaleString('fr-FR')} €/m² — P90 ${dvf.p90.toLocaleString('fr-FR')} €/m²
Écart ce bien  : ${dvf.ecartPourcent > 0 ? '+' : ''}${dvf.ecartPourcent}% vs médiane
Tendance       : ${dvf.tendance > 0 ? '+' : ''}${dvf.tendance}%/an
Nb transactions: ${dvf.nbTransactions}`

  if (lmnp) {
    prompt += `

═══ RENTABILITÉ LMNP ═══
Loyer estimé   : ${lmnp.loyer.toLocaleString('fr-FR')} €/mois
Apport         : ${lmnp.apport.toLocaleString('fr-FR')} €
Travaux        : ${lmnp.travaux.toLocaleString('fr-FR')} €
Prix total     : ${lmnp.prixTotal.toLocaleString('fr-FR')} €
Mensualité crédit: ${lmnp.mensualiteCredit.toLocaleString('fr-FR')} €/mois
Rendement brut : ${lmnp.rendementBrut}%
Rendement net  : ${lmnp.rendementNet}%
Cash-flow Micro-BIC  : ${lmnp.microBICCashflow > 0 ? '+' : ''}${lmnp.microBICCashflow.toLocaleString('fr-FR')} €/mois
Cash-flow Réel réel  : ${lmnp.reelCashflow > 0 ? '+' : ''}${lmnp.reelCashflow.toLocaleString('fr-FR')} €/mois
Amortissements : ${lmnp.amortissementTotal.toLocaleString('fr-FR')} €/an déductibles`
  }

  if (negociation) {
    prompt += `

═══ NÉGOCIATION ═══
Potentiel   : ${negociation.potentiel} (${negociation.scoreTotal}/100)
Offre reco  : ${negociation.offreRecommandee.toLocaleString('fr-FR')} € (-${negociation.remisePct}%)
Offre basse : ${negociation.offreBasse.toLocaleString('fr-FR')} €`
  }

  prompt += `

═══ INSTRUCTIONS ═══
- Réponds en français, de façon concise et opérationnelle
- Si l'utilisateur demande une simulation avec d'autres hypothèses (apport, loyer, durée…), calcule-la toi-même avec les chiffres exacts
- Pour les simulations LMNP : loyer annuel × 0.92 / prix total = rendement brut
- Mensualité crédit : formule standard taux fixe
- Si on te demande un argumentaire de négociation, rédige-le directement, prêt à envoyer
- Reste factuel, cite les chiffres de l'analyse, ne spécule pas sur des données non disponibles`

  return prompt
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, context } = await req.json() as {
      messages: ChatMessage[]
      context: AnalysisContext
    }

    if (!messages?.length || !context) {
      return new Response(JSON.stringify({ error: 'messages et context requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const systemPrompt = buildSystemPrompt(context)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    return new Response(JSON.stringify({ content: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
