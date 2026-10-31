import { describe, expect, it } from 'vitest'
import { product, rules } from '@/test/fixtures'
import { discountFor, evaluateCustomPackage, maxQuantityFor } from './customPricing'

const body = product({ id: 1, name: 'لاصق تدفئة الجسم', unitPrice: 6, piecesPerSellingUnit: 1 })
const hand = product({ id: 2, name: 'دفاية اليدين', unitPrice: 5, piecesPerSellingUnit: 2 })
const products = [body, hand]

describe('evaluateCustomPackage', () => {
  it('totals units, pieces and price', () => {
    const result = evaluateCustomPackage({ 1: 3, 2: 2 }, products, rules())

    expect(result).toMatchObject({ units: 5, pieces: 7, subtotal: 28, discount: 0, total: 28, isValid: true })
  })

  it('asks for a first product when empty, mentioning the minimum if one is set', () => {
    expect(evaluateCustomPackage({}, products, rules()).issues).toEqual([{ code: 'empty', min: null }])
    expect(evaluateCustomPackage({}, products, rules({ minItems: 5 })).issues).toEqual([{ code: 'empty', min: 5 }])
  })

  it('applies configured limits', () => {
    const configured = rules({ minItems: 5, maxItems: 8, minSubtotal: 40 })

    expect(evaluateCustomPackage({ 1: 2 }, products, configured).issues).toEqual([
      { code: 'needMore', count: 3 },
      { code: 'needAmount', amount: 28 },
    ])
    expect(evaluateCustomPackage({ 1: 9 }, products, configured).issues).toEqual([{ code: 'tooMany', max: 8 }])
    expect(evaluateCustomPackage({ 1: 7 }, products, configured).isValid).toBe(true)
  })

  it('applies the stricter of the store-wide and per-product limits', () => {
    const configured = rules({ maxQuantityPerProduct: 6, productRules: [{ productId: 1, minQty: 2, maxQty: 4 }] })

    expect(maxQuantityFor(1, configured)).toBe(4)
    expect(maxQuantityFor(2, configured)).toBe(6)
    expect(evaluateCustomPackage({ 1: 1 }, products, configured).issues).toEqual([{ code: 'productMin', name: 'لاصق تدفئة الجسم', min: 2 }])
    expect(evaluateCustomPackage({ 1: 5 }, products, configured).issues).toEqual([{ code: 'productMax', name: 'لاصق تدفئة الجسم', max: 4 }])
  })

  it('ignores products that are not available for custom packages', () => {
    const unavailable = product({ id: 3, availableForCustom: false, unitPrice: 100 })

    expect(evaluateCustomPackage({ 3: 2 }, [...products, unavailable], rules()).units).toBe(0)
  })
})

describe('discountFor (mirrors the server)', () => {
  const tiers = rules({
    discountTiers: [
      { minItems: 5, type: 'Fixed', value: 2 },
      { minItems: 10, type: 'Percent', value: 12.5 },
    ],
  })

  it('applies the highest tier reached', () => {
    expect(discountFor(24, 4, tiers)).toBe(0)
    expect(discountFor(30, 5, tiers)).toBe(2)
    expect(discountFor(5.5, 10, tiers)).toBe(0.69) // 0.6875
    expect(discountFor(1, 10, tiers)).toBe(0.13) // 0.125 rounds up
  })

  it('never exceeds the subtotal', () => {
    expect(discountFor(1, 5, tiers)).toBe(1)
  })
})
