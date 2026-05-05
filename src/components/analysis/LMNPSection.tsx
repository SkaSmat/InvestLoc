import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Euro, Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { computeLMNP } from '@/lib/mortgage'
import { getFinancialSettings } from '@/lib/supabase'
import { formatPrice, formatPct } from '@/lib/utils'
import type { FinancialSettings, LMNPResult, PropertyData } from '@/types'

interface LMNPSectionProps {
  property: PropertyData
  onResultChange?: (result: LMNPResult, loyer: number, apport: number, travaux: number) => void
}

function CashflowBadge({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-bold ${
        positive ? 'text-green-600' : 'text-destructive'
      }`}
    >
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {positive ? '+' : ''}
      {formatPrice(value)}/mois
    </span>
  )
}

function MetricRow({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={`flex justify-between items-baseline py-1.5 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-sm ${highlight ? 'text-foreground' : ''}`}>{value}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function RegimeColumn({
  regime,
  label,
  accent,
}: {
  regime: LMNPResult['microBIC'] | LMNPResult['reel']
  label: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-4 space-y-3 ${
        accent ? 'bg-primary/5 border border-primary/20' : 'bg-muted/40'
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? 'text-primary' : 'text-muted-foreground'}`}>
        {label}
      </p>

      <div className="space-y-1 divide-y divide-border">
        <MetricRow
          label="Recettes annuelles"
          value={formatPrice(regime.recettesAnnuelles)}
          sub="vacance 8% déduite"
        />
        <MetricRow
          label="Charges déductibles"
          value={formatPrice(regime.chargesDeductibles)}
        />
        <MetricRow
          label="Base imposable"
          value={formatPrice(regime.baseImposable)}
        />
        <MetricRow
          label="Impôt + PS"
          value={formatPrice(regime.impotAnnuel)}
          sub="IR + cotisations sociales"
        />
      </div>

      <Separator />

      <div className="text-center pt-1">
        <p className="text-xs text-muted-foreground mb-1">Cash-flow mensuel net</p>
        <CashflowBadge value={regime.cashflowMensuel} />
      </div>
    </div>
  )
}

export function LMNPSection({ property, onResultChange }: LMNPSectionProps) {
  const [settings, setSettings] = useState<FinancialSettings | null>(null)
  const [loyer, setLoyer] = useState<number>(() => Math.round(property.surface * 18))
  const [apport, setApport] = useState<number>(20000)
  const [travaux, setTravaux] = useState<number>(0)
  const [result, setResult] = useState<LMNPResult | null>(null)

  // Chargement des paramètres financiers (Supabase ou défauts)
  useEffect(() => {
    getFinancialSettings().then(setSettings)
  }, [])

  // Recalcul temps réel à chaque changement
  useEffect(() => {
    if (!settings) return
    const res = computeLMNP({
      prixFAI: property.price,
      surface: property.surface,
      loyerMensuel: loyer,
      apport,
      travaux,
      duree: settings.duree,
      tauxCredit: settings.tauxCredit,
      tauxAssurance: settings.tauxAssurance,
      fraisNotairesPct: settings.fraisNotairesPct,
      tmi: settings.tmi,
    })
    setResult(res)
    onResultChange?.(res, loyer, apport, travaux)
  }, [settings, loyer, apport, travaux, property])

  if (!settings || !result) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Chargement des paramètres financiers…
      </div>
    )
  }

  const bestRegime =
    result.reel.cashflowMensuel > result.microBIC.cashflowMensuel ? 'reel' : 'micro'

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="loyer" className="flex items-center gap-1.5">
            <Euro className="h-3.5 w-3.5" />
            Loyer estimé / mois
          </Label>
          <Input
            id="loyer"
            type="number"
            value={loyer}
            onChange={(e) => setLoyer(Number(e.target.value))}
            min={0}
          />
          <p className="text-xs text-muted-foreground">
            ~{Math.round(loyer / property.surface)} €/m²/mois
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apport">Apport (€)</Label>
          <Input
            id="apport"
            type="number"
            value={apport}
            onChange={(e) => setApport(Number(e.target.value))}
            min={0}
          />
          <p className="text-xs text-muted-foreground">
            {formatPct((apport / result.prixTotal) * 100)} du prix total
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="travaux">Budget travaux (€)</Label>
          <Input
            id="travaux"
            type="number"
            value={travaux}
            onChange={(e) => setTravaux(Number(e.target.value))}
            min={0}
          />
        </div>
      </div>

      {/* KPIs synthèse */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Prix total</p>
            <p className="text-lg font-bold">{formatPrice(result.prixTotal)}</p>
            <p className="text-xs text-muted-foreground">FAI + notaires + travaux</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Mensualité crédit</p>
            <p className="text-lg font-bold">{formatPrice(result.mensualiteCredit)}</p>
            <p className="text-xs text-muted-foreground">
              capital + intérêts + assurance
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Rendement brut</p>
            <p className={`text-lg font-bold ${result.rendementBrut >= 7 ? 'text-green-600' : result.rendementBrut >= 5 ? 'text-yellow-600' : 'text-destructive'}`}>
              {formatPct(result.rendementBrut)}
            </p>
            <p className="text-xs text-muted-foreground">loyer / prix total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Rendement net</p>
            <p className={`text-lg font-bold ${result.rendementNet >= 5 ? 'text-green-600' : result.rendementNet >= 3 ? 'text-yellow-600' : 'text-destructive'}`}>
              {formatPct(result.rendementNet)}
            </p>
            <p className="text-xs text-muted-foreground">charges déduites</p>
          </CardContent>
        </Card>
      </div>

      {/* Comparatif fiscal */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Comparatif fiscal LMNP
          </p>
          <span className="text-xs text-muted-foreground">
            Régime conseillé :{' '}
            <span className="font-semibold text-primary">
              {bestRegime === 'reel' ? 'Régime réel' : 'Micro-BIC'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <RegimeColumn
            regime={result.microBIC}
            label="Micro-BIC — abattement 50%"
            accent={bestRegime === 'micro'}
          />
          <RegimeColumn
            regime={result.reel}
            label="Régime réel — amortissements"
            accent={bestRegime === 'reel'}
          />
        </div>
      </div>

      {/* Amortissements */}
      <div className="rounded-lg bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Amortissements déductibles (régime réel)
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Immeuble</p>
            <p className="font-medium">{formatPrice(result.amortissementImmeuble)}/an</p>
            <p className="text-xs text-muted-foreground">85% valeur · 30 ans</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mobilier</p>
            <p className="font-medium">{formatPrice(result.amortissementMobilier)}/an</p>
            <p className="text-xs text-muted-foreground">15% valeur + travaux · 7 ans</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-bold text-primary">{formatPrice(result.amortissementTotal)}/an</p>
            <p className="text-xs text-muted-foreground">charges fictives déductibles</p>
          </div>
        </div>
      </div>

      {/* Coût crédit */}
      <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
        <span>
          Crédit sur {settings.duree} ans à {settings.tauxCredit}% + {settings.tauxAssurance}% assurance
        </span>
        <span>
          Coût total crédit :{' '}
          <span className="font-semibold text-foreground">{formatPrice(result.coutTotalCredit)}</span>
          {' '}dont intérêts{' '}
          <span className="font-semibold text-destructive">{formatPrice(result.interetsTotal)}</span>
        </span>
      </div>
    </div>
  )
}
