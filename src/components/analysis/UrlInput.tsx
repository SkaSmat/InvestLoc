import { useState } from 'react'
import { Search, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UrlInputProps {
  onSubmit: (url: string) => void
  isLoading?: boolean
}

const SUPPORTED_SITES = ['SeLoger', 'LeBonCoin', 'BienIci', 'PAP', 'Leboncoin', 'Logic-Immo']

export function UrlInput({ onSubmit, isLoading = false }: UrlInputProps) {
  const [url, setUrl] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Analyser un bien</h1>
        <p className="text-muted-foreground">
          Collez l'URL d'une annonce immobilière — l'IA extrait les données et calcule la
          rentabilité LMNP en quelques secondes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">URL de l'annonce</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              type="url"
              placeholder="https://www.seloger.com/annonces/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !url.trim()}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Extraction…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Analyser
                </span>
              )}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-muted-foreground mb-2">Sites supportés</p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUPPORTED_SITES.map((site) => (
            <span
              key={site}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground border border-border rounded px-2 py-1"
            >
              <ExternalLink className="h-3 w-3" />
              {site}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
