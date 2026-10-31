import type { TFunction } from 'i18next'
import type { Product } from '@/lib/api/types'
import { formatDimensions, formatHours, formatPieces } from '@/lib/format'

export function adhesiveLabel(product: Product, t: TFunction): string | null {
  if (product.isAdhesive === null) return null
  return product.isAdhesive ? t('product.adhesive') : t('product.notAdhesive')
}

/**
 * The specification rows shown on the details page. Rows whose value is unknown are left out
 * rather than guessed (e.g. the foot warmer's adhesive status).
 */
export function productSpecRows(product: Product, t: TFunction): { label: string; value: string }[] {
  const hours = formatHours(product.heatMinHours, product.heatMaxHours)
  const adhesive = adhesiveLabel(product, t)

  const rows = [
    hours && { label: t('product.heatDuration'), value: t('product.approximately', { value: hours }) },
    { label: t('product.size'), value: formatDimensions(product.widthCm, product.heightCm) },
    { label: t('product.bagContents'), value: formatPieces(product.piecesPerRetailBag) },
    adhesive && { label: t('product.type'), value: adhesive },
    {
      label: t('product.soldBy'),
      value:
        product.sellingUnit === 'Piece'
          ? t('product.soldByPiece')
          : t('product.soldByBag', { pieces: formatPieces(product.piecesPerSellingUnit) }),
    },
  ]

  return rows.filter((row): row is { label: string; value: string } => !!row)
}
