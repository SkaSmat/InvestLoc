import { ExternalLink, TrendingDown, TrendingUp, Minus, MapPin, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { PricePositionBar } from './PricePositionBar'
import { DVFChart } from './DVFChart'
import { formatPrice, formatPriceM2, formatPct, daysSince } from '@/lib/utils'
import type { PropertyData, DVFAnalysisResult } from '@/types'

interface AnalysisResultProps {
  property: PropertyData
  dvf: DVFAnalysisResult
  onReset: () => void
}

function EcartBadge({ ecart }: { ecart: number }) {
  if (ecart > 10)
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        Cher +{formatPct(ecart)}
      </Badge>
    )
  if (ecart < -10)
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <TrendingDown className="h-3 w-3" />
        Opportunité {formatPct(ecart)}
      </Badge>
    )
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Minus className="h-3 w-3" />
      Prix marché
    </Badge>
  )
}

const conditionLabels: Record<PropertyData['condition'], string> = {
  neuf: 'Neuf / rénové',
  bon: 'Bon état',
  moyen: 'État moyen',
  travaux: 'Travaux',
}

export function AnalysisResult({ property, dvf, onReset }: AnalysisResultProps) {
  const prixM2 = Math.round(property.price / property.surface)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold leading-tight">{property.title}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}, {property.postalCode} {property.city}
          </div>
          {property.publishedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Publiée il y a {daysSince(property.publishedAt)} jours
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <EcartBadge ecart={dvf.ecartPourcent} />
          <Badge variant="outline">{conditionLabels[property.condition]}</Badge>
        </div>
      </div>

      {/* Prix synthèse */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Prix annoncé</p>
            <p className="text-2xl font-bold">{formatPrice(property.price)}</p>
            <p className="text-sm text-muted-foreground">{formatPriceM2(prixM2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Médiane DVF</p>
            <p className="text-2xl font-bold">{formatPriceM2(dvf.mediane)}</p>
            <p className="text-sm text-muted-foreground">{dvf.nbTransactions} ventes analysées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Surface</p>
            <p className="text-2xl font-bold">{property.surface} m²</p>
            <p className="text-sm text-muted-foreground">{property.rooms} pièce{property.rooms > 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Position marché */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Positionnement prix marché</CardTitle>
        </CardHeader>
        <CardContent>
          <PricePositionBar dvf={dvf} property={property} />
        </CardContent>
      </Card>

      {/* Histogramme DVF */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Marché local — transactions DVF</CardTitle>
        </CardHeader>
        <CardContent>
          <DVFChart dvf={dvf} property={property} />
        </CardContent>
      </Card>

      {/* Tendance */}
      {dvf.tendance !== 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tendance des prix sur ce marché</span>
              <span
                className={`text-lg font-bold ${dvf.tendance > 0 ? 'text-green-600' : 'text-destructive'}`}
              >
                {dvf.tendance > 0 ? '+' : ''}
                {formatPct(dvf.tendance)}/an
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href={property.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Voir l'annonce
          </a>
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Nouvelle analyse
        </Button>
      </div>
    </div>
  )
}
