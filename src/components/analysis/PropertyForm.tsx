import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PropertyData } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Titre requis'),
  price: z.coerce.number().positive('Prix requis'),
  surface: z.coerce.number().positive('Surface requise'),
  rooms: z.coerce.number().int().positive('Nombre de pièces requis'),
  address: z.string().min(1, 'Adresse requise'),
  postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
  city: z.string().min(1, 'Ville requise'),
  condition: z.enum(['neuf', 'bon', 'moyen', 'travaux']),
  publishedAt: z.string().nullable(),
  description: z.string(),
})

type FormValues = z.infer<typeof schema>

interface PropertyFormProps {
  initialData: PropertyData
  onSubmit: (data: PropertyData) => void
  isLoading?: boolean
}

export function PropertyForm({ initialData, onSubmit, isLoading = false }: PropertyFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialData.title,
      price: initialData.price,
      surface: initialData.surface,
      rooms: initialData.rooms,
      address: initialData.address,
      postalCode: initialData.postalCode,
      city: initialData.city,
      condition: initialData.condition,
      publishedAt: initialData.publishedAt,
      description: initialData.description,
    },
  })

  const condition = watch('condition')

  function onFormSubmit(values: FormValues) {
    onSubmit({ ...initialData, ...values })
  }

  const conditionLabels: Record<PropertyData['condition'], string> = {
    neuf: 'Neuf / rénové',
    bon: 'Bon état',
    moyen: 'État moyen',
    travaux: 'Travaux à prévoir',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vérifier les données extraites</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
          {/* Titre */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Titre de l'annonce</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Prix / Surface / Pièces */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Prix FAI (€)</Label>
              <Input id="price" type="number" {...register('price')} />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="surface">Surface (m²)</Label>
              <Input id="surface" type="number" step="0.1" {...register('surface')} />
              {errors.surface && (
                <p className="text-xs text-destructive">{errors.surface.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rooms">Pièces</Label>
              <Input id="rooms" type="number" {...register('rooms')} />
              {errors.rooms && <p className="text-xs text-destructive">{errors.rooms.message}</p>}
            </div>
          </div>

          {/* Adresse */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" {...register('address')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Code postal</Label>
              <Input id="postalCode" {...register('postalCode')} maxLength={5} />
              {errors.postalCode && (
                <p className="text-xs text-destructive">{errors.postalCode.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ville</Label>
              <Input id="city" {...register('city')} />
            </div>
          </div>

          {/* État */}
          <div className="space-y-1.5">
            <Label>État du bien</Label>
            <Select
              value={condition}
              onValueChange={(v) => setValue('condition', v as PropertyData['condition'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(conditionLabels) as PropertyData['condition'][]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {conditionLabels[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={4} {...register('description')} />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Analyse en cours…' : 'Lancer l'analyse DVF + LMNP'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
