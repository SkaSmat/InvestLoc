import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { UrlInput } from '@/components/analysis/UrlInput'
import { PropertyForm } from '@/components/analysis/PropertyForm'
import { AnalysisResult } from '@/components/analysis/AnalysisResult'
import { Skeleton } from '@/components/ui/skeleton'
import { invokeExtractListing } from '@/lib/supabase'
import { fetchDVFStats } from '@/lib/dvf'
import type { AnalysisState, PropertyData } from '@/types'

const INITIAL_STATE: AnalysisState = {
  step: 'url_input',
  url: '',
  property: null,
  dvf: null,
  error: null,
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground">{message}</p>
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-3/4" />
    </div>
  )
}

export function AnalyzePage() {
  const location = useLocation()
  const prefilled = location.state as { property: PropertyData; dvf: ReturnType<typeof fetchDVFStats> extends Promise<infer T> ? T : never } | null

  const [state, setState] = useState<AnalysisState>(() => {
    if (prefilled?.property && prefilled?.dvf) {
      return { ...INITIAL_STATE, step: 'results', property: prefilled.property, dvf: prefilled.dvf as AnalysisState['dvf'] }
    }
    return INITIAL_STATE
  })

  async function handleUrlSubmit(url: string) {
    setState({ ...INITIAL_STATE, step: 'extracting', url })
    try {
      const data = await invokeExtractListing(url)
      setState((s) => ({ ...s, step: 'form', property: data as PropertyData }))
    } catch (err) {
      setState((s) => ({
        ...s,
        step: 'url_input',
        error: err instanceof Error ? err.message : "Erreur lors de l'extraction",
      }))
    }
  }

  async function handleFormSubmit(property: PropertyData) {
    setState((s) => ({ ...s, step: 'analyzing', property }))
    try {
      const dvf = await fetchDVFStats(
        property.postalCode,
        property.city,
        property.surface,
        property.price
      )
      setState((s) => ({ ...s, step: 'results', dvf }))
    } catch (err) {
      setState((s) => ({
        ...s,
        step: 'form',
        error: err instanceof Error ? err.message : "Erreur lors de l'analyse DVF",
      }))
    }
  }

  function handleReset() {
    setState(INITIAL_STATE)
  }

  return (
    <div className="p-8">
      {/* Erreur globale */}
      {state.error && (
        <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{state.error}</p>
        </div>
      )}

      {state.step === 'url_input' && <UrlInput onSubmit={handleUrlSubmit} />}

      {state.step === 'extracting' && (
        <LoadingState message="Extraction des données par l'IA en cours…" />
      )}

      {state.step === 'form' && state.property && (
        <div className="max-w-2xl mx-auto">
          <PropertyForm
            initialData={state.property}
            onSubmit={handleFormSubmit}
            isLoading={false}
          />
        </div>
      )}

      {state.step === 'analyzing' && (
        <LoadingState message="Récupération des données DVF et calcul de rentabilité…" />
      )}

      {state.step === 'results' && state.property && state.dvf && (
        <div className="max-w-3xl mx-auto">
          <AnalysisResult property={state.property} dvf={state.dvf} onReset={handleReset} />
        </div>
      )}
    </div>
  )
}
