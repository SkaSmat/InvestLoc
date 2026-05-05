// Supabase Edge Function — Deno runtime
// Score un quartier sur 5 axes via Claude + web_search.
// ANTHROPIC_API_KEY stockée en secret Supabase.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

// Outil de sortie structurée — force Claude à retourner les scores JSON
const scoreTool: Anthropic.Tool = {
  name: 'score_quartier',
  description: 'Retourne le score d\'un quartier sur 5 axes pour investissement locatif LMNP meublé.',
  input_schema: {
    type: 'object' as const,
    properties: {
      transports: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 1, maximum: 5 },
          justification: { type: 'string' },
        },
        required: ['score', 'justification'],
      },
      commerces: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 1, maximum: 5 },
          justification: { type: 'string' },
        },
        required: ['score', 'justification'],
      },
      ecoles: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 1, maximum: 5 },
          justification: { type: 'string' },
        },
        required: ['score', 'justification'],
      },
      securite: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 1, maximum: 5 },
          justification: { type: 'string' },
        },
        required: ['score', 'justification'],
      },
      dynamique_immo: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 1, maximum: 5 },
          justification: { type: 'string' },
        },
        required: ['score', 'justification'],
      },
      synthese: {
        type: 'string',
        description: 'Synthèse en 2-3 phrases du quartier pour un investisseur LMNP',
      },
    },
    required: ['transports', 'commerces', 'ecoles', 'securite', 'dynamique_immo', 'synthese'],
  },
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { city, postalCode, address } = await req.json()
    if (!city || !postalCode) {
      return new Response(JSON.stringify({ error: 'city et postalCode requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lieu = address ? `${address}, ${postalCode} ${city}` : `${postalCode} ${city}`

    const prompt = `Tu es un expert en investissement immobilier locatif LMNP en Île-de-France.
Recherche des informations sur ce quartier et note-le sur 5 axes (score 1 à 5) :

Lieu : ${lieu}

Axes à évaluer :
1. **Transports** : proximité métro/RER/bus, score TER, accessibilité Paris
2. **Commerces & services** : supermarchés, restaurants, pharmacie, commodités du quotidien
3. **Écoles** : présence d'écoles, collèges, lycées, universités, attractivité pour familles/étudiants
4. **Sécurité** : niveau de criminalité, sentiment de sécurité, statistiques disponibles
5. **Dynamique immobilière** : demande locative, taux de vacance, projets urbains, attractivité investisseurs

Critères de notation :
- 5 = excellent, bien au-dessus de la moyenne IDF
- 4 = bon, au-dessus de la moyenne
- 3 = moyen, dans la moyenne IDF
- 2 = en dessous de la moyenne, points faibles notables
- 1 = très faible, frein sérieux à l'investissement

Utilise web_search pour trouver des données concrètes avant de scorer.`

    // Appel avec web_search activé puis tool_use pour la sortie structurée
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [
        // @ts-ignore — web_search_20250305 est un outil natif Anthropic
        { type: 'web_search_20250305', name: 'web_search' },
        scoreTool,
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    // Récupérer le résultat de l'outil score_quartier
    const toolUse = response.content.find(
      (b) => b.type === 'tool_use' && b.name === 'score_quartier'
    )

    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude n\'a pas retourné de score structuré')
    }

    const raw = toolUse.input as Record<string, { score: number; justification: string } | string>

    const result = {
      transports: raw.transports,
      commerces: raw.commerces,
      ecoles: raw.ecoles,
      securite: raw.securite,
      // snake_case → camelCase pour le frontend
      dynamiqueImmo: raw.dynamique_immo,
      synthese: raw.synthese,
      total:
        (raw.transports as { score: number }).score +
        (raw.commerces as { score: number }).score +
        (raw.ecoles as { score: number }).score +
        (raw.securite as { score: number }).score +
        (raw.dynamique_immo as { score: number }).score,
    }

    return new Response(JSON.stringify(result), {
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
