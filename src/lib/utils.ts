import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatPriceM2(priceM2: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(priceM2)} €/m²`
}

export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)} %`
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimals }).format(value)
}

/** Retourne le nombre de jours depuis une date ISO */
export function daysSince(isoDate: string): number {
  const d = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}
