import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, CheckCircle } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  getFinancialSettings,
  upsertFinancialSettings,
  getSearchProfile,
  upsertSearchProfile,
  DEFAULT_FINANCIAL_SETTINGS,
  DEFAULT_SEARCH_PROFILE,
} from '@/lib/supabase'
import type { FinancialSettings, SearchProfile } from '@/types'

// ─── Schémas ──────────────────────────────────────────────────────────────────

const financialSchema = z.object({
  tauxCredit: z.coerce.number().min(0).max(20),
  tauxAssurance: z.coerce.number().min(0).max(5),
  duree: z.coerce.number().int().min(5).max(30),
  fraisNotairesPct: z.coerce.number().min(0).max(15),
  tmi: z.coerce.number().min(0).max(45),
})

const searchSchema = z.object({
  budgetMax: z.coerce.number().positive(),
  rendementMinBrut: z.coerce.number().min(0).max(30),
  surfaceMin: z.coerce.number().int().positive(),
  surfaceMax: z.coerce.number().int().positive(),
})

type FinancialFormValues = z.infer<typeof financialSchema>
type SearchFormValues = z.infer<typeof searchSchema>

// ─── Composant ────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [savedFinancial, setSavedFinancial] = useState(false)
  const [savedSearch, setSavedSearch] = useState(false)
  const [loadingFinancial, setLoadingFinancial] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const financialForm = useForm<FinancialFormValues>({
    resolver: zodResolver(financialSchema),
    defaultValues: DEFAULT_FINANCIAL_SETTINGS,
  })

  const searchForm = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      budgetMax: DEFAULT_SEARCH_PROFILE.budgetMax,
      rendementMinBrut: DEFAULT_SEARCH_PROFILE.rendementMinBrut,
      surfaceMin: DEFAULT_SEARCH_PROFILE.surfaceMin,
      surfaceMax: DEFAULT_SEARCH_PROFILE.surfaceMax,
    },
  })

  useEffect(() => {
    getFinancialSettings().then((data: FinancialSettings) => {
      financialForm.reset({
        tauxCredit: data.tauxCredit,
        tauxAssurance: data.tauxAssurance,
        duree: data.duree,
        fraisNotairesPct: data.fraisNotairesPct,
        tmi: data.tmi,
      })
    })
    getSearchProfile().then((data: SearchProfile) => {
      searchForm.reset({
        budgetMax: data.budgetMax,
        rendementMinBrut: data.rendementMinBrut,
        surfaceMin: data.surfaceMin,
        surfaceMax: data.surfaceMax,
      })
    })
  }, [])

  async function onFinancialSubmit(values: FinancialFormValues) {
    setLoadingFinancial(true)
    try {
      await upsertFinancialSettings(values)
      setSavedFinancial(true)
      setTimeout(() => setSavedFinancial(false), 3000)
    } finally {
      setLoadingFinancial(false)
    }
  }

  async function onSearchSubmit(values: SearchFormValues) {
    setLoadingSearch(true)
    try {
      await upsertSearchProfile({
        ...DEFAULT_SEARCH_PROFILE,
        ...values,
      })
      setSavedSearch(true)
      setTimeout(() => setSavedSearch(false), 3000)
    } finally {
      setLoadingSearch(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">Configurez vos paramètres financiers et de chasse.</p>
      </div>

      {/* Paramètres financiers */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres financiers</CardTitle>
          <CardDescription>
            Utilisés pour tous les calculs LMNP et simulations de crédit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={financialForm.handleSubmit(onFinancialSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Taux crédit (%)</Label>
                <Input type="number" step="0.05" {...financialForm.register('tauxCredit')} />
              </div>
              <div className="space-y-1.5">
                <Label>Taux assurance (%)</Label>
                <Input type="number" step="0.01" {...financialForm.register('tauxAssurance')} />
              </div>
              <div className="space-y-1.5">
                <Label>Durée du prêt (ans)</Label>
                <Input type="number" {...financialForm.register('duree')} />
              </div>
              <div className="space-y-1.5">
                <Label>Frais de notaires (%)</Label>
                <Input type="number" step="0.5" {...financialForm.register('fraisNotairesPct')} />
              </div>
              <div className="space-y-1.5">
                <Label>TMI — Tranche marginale (%)</Label>
                <Input type="number" {...financialForm.register('tmi')} />
              </div>
            </div>
            <Button type="submit" disabled={loadingFinancial} className="w-full">
              {savedFinancial ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Enregistré
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {loadingFinancial ? 'Enregistrement…' : 'Enregistrer'}
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Profil de chasse */}
      <Card>
        <CardHeader>
          <CardTitle>Profil de chasse</CardTitle>
          <CardDescription>
            Critères utilisés par l'agent autonome pour filtrer les opportunités.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Budget max FAI (€)</Label>
                <Input type="number" {...searchForm.register('budgetMax')} />
              </div>
              <div className="space-y-1.5">
                <Label>Rendement brut min (%)</Label>
                <Input type="number" step="0.5" {...searchForm.register('rendementMinBrut')} />
              </div>
              <div className="space-y-1.5">
                <Label>Surface min (m²)</Label>
                <Input type="number" {...searchForm.register('surfaceMin')} />
              </div>
              <div className="space-y-1.5">
                <Label>Surface max (m²)</Label>
                <Input type="number" {...searchForm.register('surfaceMax')} />
              </div>
            </div>
            <Button type="submit" disabled={loadingSearch} className="w-full">
              {savedSearch ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Enregistré
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {loadingSearch ? 'Enregistrement…' : 'Enregistrer'}
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
