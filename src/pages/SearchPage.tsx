import { useState } from 'react'
import { Search, Loader2, ExternalLink, TrendingUp, Home, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { fetchDVFStats } from '@/lib/dvf'
import { useNavigate } from 'react-router-dom'
import { formatPrice } from '@/lib/utils'
import type { PropertyData } from '@/types'

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

interface SearchCriteria {
  city: string
  postalCode: string
  budgetMax: number
  surfaceMin: number
  surfaceMax: number
  typeBien: 'appartement' | 'maison' | 'tous'
}

const DEFAULT_CRITERIA: SearchCriteria = {
  city: 'Paris',
  postalCode: '75013',
  budgetMax: 200000,
  surfaceMin: 20,
  surfaceMax: 50,
  typeBien: 'appartement',
}

export function SearchPage() {
  const navigate = useNavigate()
  const [criteria, setCriteria] = useState<SearchCriteria>(DEFAULT_CRITERIA)
  const [listings, setListings] = useState<ListingResult[]>([])
  const [searchUrl, setSearchUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof SearchCriteria>(key: K, value: SearchCriteria[K]) {
    setCriteria((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSearch() {
    setLoading(true)
    setError(null)
    setListings([])

    try {
      const { data, error } = await supabase.functions.invoke('search-listings', {
        body: criteria,
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      setListings(data.listings ?? [])
      setSearchUrl(data.searchUrl ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyze(listing: ListingResult) {
    setAnalyzing(listing.url)
    try {
      const { data, error } = await supabase.functions.invoke('extract-listing', {
        body: { url: listing.url },
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)

      const property = data as PropertyData
      const dvf = await fetchDVFStats(
        property.postalCode,
        property.city,
        property.surface,
        property.price
      )

      // Store in sessionStorage and navigate to analyze page
      sessionStorage.setItem('pendingAnalysis', JSON.stringify({ property, dvf }))
      navigate('/', { state: { property, dvf } })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse")
    } finally {
      setAnalyzing(null)
    }
  }

  const prixM2 = (listing: ListingResult) =>
    listing.surface > 0 ? Math.round(listing.price / listing.surface) : 0

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Recherche automatique</h1>
        <p className="text-muted-foreground mt-1">
          Renseigne tes criteres — l'IA cherche et analyse les annonces LeBonCoin pour toi.
        </p>
      </div>

      {/* Formulaire */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Criteres de recherche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ville</Label>
              <Input
                value={criteria.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Paris, Lyon, Marseille..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code postal</Label>
              <Input
                value={criteria.postalCode}
                onChange={(e) => update('postalCode', e.target.value)}
                placeholder="75013"
                maxLength={5}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Budget max (€)</Label>
              <Input
                type="number"
                value={criteria.budgetMax}
                onChange={(e) => update('budgetMax', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Surface min (m²)</Label>
              <Input
                type="number"
                value={criteria.surfaceMin}
                onChange={(e) => update('surfaceMin', Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Surface max (m²)</Label>
              <Input
                type="number"
                value={criteria.surfaceMax}
                onChange={(e) => update('surfaceMax', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type de bien</Label>
            <Select
              value={criteria.typeBien}
              onValueChange={(v) => update('typeBien', v as SearchCriteria['typeBien'])}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="appartement">Appartement</SelectItem>
                <SelectItem value="maison">Maison</SelectItem>
                <SelectItem value="tous">Tous types</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSearch} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recherche en cours...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Rechercher les annonces
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Resultats */}
      {listings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {listings.length} annonce{listings.length > 1 ? 's' : ''} trouvee{listings.length > 1 ? 's' : ''}
            </h2>
            {searchUrl && (
              <a
                href={searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Voir sur LeBonCoin
              </a>
            )}
          </div>

          <div className="space-y-3">
            {listings.map((listing, i) => (
              <Card key={i} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm leading-tight truncate">{listing.title}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Home className="h-3.5 w-3.5" />
                          {listing.surface} m²
                          {listing.rooms > 0 && ` · ${listing.rooms} p.`}
                        </span>
                        <span>{listing.city}</span>
                      </div>
                      {listing.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {listing.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right space-y-2">
                      <div>
                        <p className="font-bold text-lg">{formatPrice(listing.price)}</p>
                        {prixM2(listing) > 0 && (
                          <p className="text-xs text-muted-foreground">{prixM2(listing).toLocaleString('fr-FR')} €/m²</p>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={listing.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAnalyze(listing)}
                          disabled={analyzing === listing.url}
                        >
                          {analyzing === listing.url ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <TrendingUp className="h-3.5 w-3.5 mr-1" />
                              Analyser
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && listings.length === 0 && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Lance une recherche pour voir les annonces disponibles</p>
        </div>
      )}
    </div>
  )
}
