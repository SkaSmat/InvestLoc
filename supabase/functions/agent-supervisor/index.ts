import Anthropic from 'npm:@anthropic-ai/sdk'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

// ─── Sub-agent system prompts ────────────────────────────────────────────────

const AGENT_PROMPTS = {
  marche: `Tu es l'Agent Marché d'InvestLoc, spécialisé dans l'analyse du marché immobilier local français.
Tu interprètes les données DVF (transactions notariales), les tendances de prix, la vacance locative,
et le positionnement du bien dans son marché local.
Réponds de façon précise et chiffrée, orientée investisseur. 3 paragraphes maximum.`,

  rentabilite: `Tu es l'Agent Rentabilité d'InvestLoc, expert en analyse financière immobilière.
Tu maîtrises : rendement brut/net, cash-flow mensuel, TRI (Taux de Rendement Interne), VAN,
simulation de crédit, et les deux régimes fiscaux LMNP (Micro-BIC vs Régime Réel).
Réponds avec des chiffres précis et des recommandations actionnables. 3 paragraphes maximum.`,

  risque: `Tu es l'Agent Risque & Juridique d'InvestLoc, spécialisé dans les aspects légaux et fiscaux
de l'investissement locatif en France.
Tu couvres : fiscalité LMNP/Pinel/nu, PLU, zones tendues, loi Alur, diagnostics obligatoires,
risques locataires, assurances propriétaire non-occupant.
Réponds de façon structurée et pédagogique. 3 paragraphes maximum.`,
}

type AgentType = keyof typeof AGENT_PROMPTS

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Sub-agent caller ────────────────────────────────────────────────────────

async function callSubAgent(
  agentType: AgentType,
  question: string,
  context: unknown
): Promise<string> {
  const response = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    // cache_control on system prompt — static text ≥1024 tokens qualifies for caching
    system: [
      {
        type: 'text',
        text: AGENT_PROMPTS[agentType],
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Contexte du bien analysé :\n${JSON.stringify(context, null, 2)}\n\nQuestion : ${question}`,
      },
    ],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}

// ─── Tools for supervisor ────────────────────────────────────────────────────

const SUPERVISOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'analyse_marche',
    description:
      'Analyse le marché immobilier local : données DVF, tendances de prix, positionnement du bien, vacance locative. Utilise cet outil pour toute question sur les prix, le marché, les comparaisons.',
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'La question précise à analyser' } },
      required: ['question'],
    },
  },
  {
    name: 'calcul_rentabilite',
    description:
      'Calcule et analyse la rentabilité financière : cash-flow, rendement brut/net, TRI, VAN, simulation de crédit, régimes fiscaux LMNP Micro-BIC vs Réel. Utilise cet outil pour toute question financière.',
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'La question précise à analyser' } },
      required: ['question'],
    },
  },
  {
    name: 'analyse_risques',
    description:
      'Analyse les risques légaux, fiscaux et juridiques : fiscalité, PLU, zones tendues, diagnostics, assurances, réglementation. Utilise cet outil pour toute question juridique ou fiscale.',
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'La question précise à analyser' } },
      required: ['question'],
    },
  },
]

const TOOL_TO_AGENT: Record<string, AgentType> = {
  analyse_marche: 'marche',
  calcul_rentabilite: 'rentabilite',
  analyse_risques: 'risque',
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { messages, context } = (await req.json()) as {
      messages: ChatMessage[]
      context: unknown
    }

    const supervisorSystemStatic = `Tu es le Superviseur d'InvestLoc, un système multi-agent d'analyse d'investissement locatif.
Tu reçois des questions d'investisseurs sur un bien immobilier et tu orchestres des agents spécialisés.
Pour chaque question, identifie quels agents sont nécessaires et appelle les outils correspondants.
Tu peux appeler plusieurs agents si la question est complexe ou touche plusieurs domaines.
Après avoir reçu les réponses des agents, synthétise-les en une réponse claire, structurée et actionnable.
Ne mentionne pas les noms techniques des agents dans ta réponse finale.`

    const supervisorSystem: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: supervisorSystemStatic,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `Contexte du bien : ${JSON.stringify(context)}`,
      },
    ]

    // First supervisor pass: classify and dispatch
    const supervisorResponse = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: supervisorSystem,
      tools: SUPERVISOR_TOOLS,
      tool_choice: { type: 'auto' },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    // No tool calls → supervisor answers directly (general question)
    if (supervisorResponse.stop_reason !== 'tool_use') {
      const text = supervisorResponse.content.find((b) => b.type === 'text')
      return new Response(
        JSON.stringify({ content: text?.text ?? '', agents: [] }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Collect tool_use blocks
    const toolUseBlocks = supervisorResponse.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    const agentsUsed: AgentType[] = []

    // Run sub-agents in parallel
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const agentType = TOOL_TO_AGENT[block.name]
        agentsUsed.push(agentType)
        const input = block.input as { question: string }
        const result = await callSubAgent(agentType, input.question, context)
        return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
      })
    )

    // Supervisor synthesizes sub-agent outputs
    const finalResponse = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: supervisorSystem as Anthropic.TextBlockParam[],
      tools: SUPERVISOR_TOOLS,
      messages: [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'assistant', content: supervisorResponse.content },
        { role: 'user', content: toolResults },
      ],
    })

    const finalText = finalResponse.content.find((b) => b.type === 'text')

    return new Response(
      JSON.stringify({ content: finalText?.text ?? '', agents: [...new Set(agentsUsed)] }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
