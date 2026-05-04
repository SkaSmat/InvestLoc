// Supabase Edge Function — Deno runtime
// Extrait les données structurées d'une annonce immobilière via Claude tool_use.
// La clé ANTHROPIC_API_KEY est stockée en secret Supabase, jamais exposée côté frontend.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const client = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
})

// Outil Claude : forcer une sortie JSON structurée
const extractTool: Anthropic.Tool = {
  name: 'extract_property',
  description:
    'Extrait les données structurées d'une annonce immobilière depuis son contenu textuel.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Titre de l'annonce' },
      price: { type: 'number', description: 'Prix FAI en euros' },
      surface: { type: 'number', description: 'Surface habitable en m²' },
      rooms: { type: 'integer', description: 'Nombre de pièces' },
      address: { type: 'string', description: 'Adresse complète ou partielle' },
      postalCode: {
        type: 'string',
        description: 'Code postal (5 chiffres)',
        pattern: '^\\d{5}$',
      },
      city: { type: 'string', description: 'Nom de la ville' },
      condition: {
        type: 'string',
        enum: ['neuf', 'bon', 'moyen', 'travaux'],
        description: 'État général du bien',
      },
      publishedAt: {
        type: 'string',
        description: 'Date de publication au format ISO 8601 (YYYY-MM-DD), null si inconnue',
        nullable: true,
      },
      description: { type: 'string', description: 'Description complète du bien' },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: 'URLs des photos (peut être vide)',
      },
    },
    required: [
      'title',
      'price',
      'surface',
      'rooms',
      'address',
      'postalCode',
      'city',
      'condition',
      'description',
    ],
  },
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url manquante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch de la page annonce
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; ImmoAgent/1.0; +https://github.com/SkaSmat/InvestLoc)',
      },
    })

    if (!pageRes.ok) {
      throw new Error(`Impossible de récupérer l'annonce (HTTP ${pageRes.status})`)
    }

    // Extraction du texte brut (strip HTML basique)
    const html = await pageRes.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 12000) // 12k chars suffisent largement + économie tokens

    // Appel Claude avec tool_use — anti-hallucination
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [extractTool],
      tool_choice: { type: 'tool', name: 'extract_property' },
      messages: [
        {
          role: 'user',
          content: `Extrais les données de cette annonce immobilière française.\n\nURL : ${url}\n\nContenu de la page :\n${text}`,
        },
      ],
    })

    // Récupérer le résultat de l'outil
    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude n'a pas retourné de résultat structuré')
    }

    const propertyData = { ...(toolUse.input as Record<string, unknown>), url }

    return new Response(JSON.stringify(propertyData), {
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
