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
    "Extrait les donnees structurees d'une annonce immobiliere depuis son contenu textuel.",
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: "Titre de l'annonce" },
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

    // ── Scraping tiered : direct → Jina AI (gratuit) → ScrapingBee (payant) ──
    let html = ''
    let scraperUsed = 'direct'

    // Tier 1 : fetch direct (fonctionne sur PAP, certains sites sans protection)
    try {
      const directRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (directRes.ok) {
        const raw = await directRes.text()
        // Vérifie qu'on n'a pas eu un CAPTCHA / page de blocage (< 500 mots utiles = suspect)
        const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ')
        if (stripped.split(' ').length > 300) {
          html = raw
          scraperUsed = 'direct'
        }
      }
    } catch { /* passe au niveau suivant */ }

    // Tier 2 : Jina AI Reader (gratuit, 200 req/jour, bon pour pages statiques)
    if (!html) {
      try {
        const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
          headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
          signal: AbortSignal.timeout(10000),
        })
        if (jinaRes.ok) {
          const raw = await jinaRes.text()
          const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ')
          if (stripped.split(' ').length > 300) {
            html = raw
            scraperUsed = 'jina'
          }
        }
      } catch { /* passe au niveau suivant */ }
    }

    // Tier 3 : ScrapingBee premium (JS rendering, proxy résidentiel — coûte des crédits)
    if (!html) {
      const scrapingBeeKey = Deno.env.get('SCRAPINGBEE_API_KEY')
      const params = new URLSearchParams({
        api_key: scrapingBeeKey ?? '',
        url,
        render_js: 'true',
        premium_proxy: 'true',
        country_code: 'fr',
        block_ads: 'true',
        wait: '2000',
      })
      const pageRes = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`)
      if (!pageRes.ok) {
        throw new Error(`Impossible de recuperer l'annonce (ScrapingBee HTTP ${pageRes.status})`)
      }
      html = await pageRes.text()
      scraperUsed = 'scrapingbee'
    }

    console.log(`Scraper used: ${scraperUsed} for ${url}`)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 15000)

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
      throw new Error("Claude n'a pas retourne de resultat structure")
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
