import Anthropic from 'npm:@anthropic-ai/sdk'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

interface SearchCriteria {
  city: string
  postalCode: string
  budgetMax: number
  surfaceMin: number
  surfaceMax: number
  typeBien: 'appartement' | 'maison' | 'tous'
}

interface ListingResult {
  title: string
  price: number
  surface: number
  rooms: number
  city: string
  url: string
  publishedAt: string | null
  description: string
}

function buildLeBonCoinUrl(criteria: SearchCriteria): string {
  const typeMap: Record<string, string> = {
    appartement: '1',
    maison: '2',
    tous: '1,2',
  }
  const params = new URLSearchParams({
    category: '9',
    locations: `${criteria.city}_${criteria.postalCode}`,
    price: `0-${criteria.budgetMax}`,
    square: `${criteria.surfaceMin}-${criteria.surfaceMax}`,
    real_estate_type: typeMap[criteria.typeBien] ?? '1',
  })
  return `https://www.leboncoin.fr/recherche?${params.toString()}`
}

async function fetchWithScrapingBee(url: string): Promise<string> {
  const key = Deno.env.get('SCRAPINGBEE_API_KEY')
  const apiUrl = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(url)}&render_js=true&block_ads=true&wait=2000`
  const res = await fetch(apiUrl)
  if (!res.ok) throw new Error(`ScrapingBee HTTP ${res.status}`)
  return res.text()
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 20000)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const criteria = (await req.json()) as SearchCriteria

    const searchUrl = buildLeBonCoinUrl(criteria)
    const html = await fetchWithScrapingBee(searchUrl)
    const text = stripHtml(html)

    // Extract __NEXT_DATA__ JSON if present (LeBonCoin embeds listing data)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    let structuredData = ''
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1])
        const ads = nextData?.props?.pageProps?.searchData?.ads ?? []
        structuredData = JSON.stringify(ads.slice(0, 20))
      } catch {
        // fallback to text
      }
    }

    const content = structuredData
      ? `Données structurées des annonces LeBonCoin (JSON):\n${structuredData}`
      : `Contenu de la page de recherche LeBonCoin:\n${text}`

    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      tools: [
        {
          name: 'extract_listings',
          description: 'Extrait la liste des annonces immobilieres depuis le contenu de la page',
          input_schema: {
            type: 'object',
            properties: {
              listings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    price: { type: 'number' },
                    surface: { type: 'number' },
                    rooms: { type: 'number' },
                    city: { type: 'string' },
                    url: { type: 'string' },
                    publishedAt: { type: 'string', nullable: true },
                    description: { type: 'string' },
                  },
                  required: ['title', 'price', 'surface', 'url'],
                },
              },
            },
            required: ['listings'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_listings' },
      messages: [
        {
          role: 'user',
          content: `Criteres de recherche: ${JSON.stringify(criteria)}\n\nURL de recherche: ${searchUrl}\n\n${content}\n\nExtrait toutes les annonces disponibles avec leurs details (titre, prix, surface, pieces, ville, URL complete leboncoin.fr).`,
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Aucune annonce extraite')
    }

    const { listings } = toolUse.input as { listings: ListingResult[] }

    return new Response(
      JSON.stringify({ listings, searchUrl, total: listings.length }),
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
