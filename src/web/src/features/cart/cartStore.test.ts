import { describe, expect, it } from 'vitest'
import { cartCount, sanitizeLines, toCartRequest, useCart } from './cartStore'

const state = () => useCart.getState()

describe('cart store', () => {
  it('merges the same ready-made package into one line and caps the quantity', () => {
    state().addReadyMade(10, 'باقة الأسبوع', 2)
    state().addReadyMade(10, 'باقة الأسبوع', 3)
    state().addReadyMade(11, 'باقة اليوم', 200)

    expect(state().lines.map((l) => (l.kind === 'ReadyMade' ? [l.packageId, l.quantity] : null))).toEqual([
      [10, 5],
      [11, 99],
    ])
    expect(cartCount(state().lines)).toBe(104)
  })

  it('changes quantities and removes a line at zero', () => {
    state().addReadyMade(10, 'باقة', 1)
    const { lineId } = state().lines[0]

    state().setQuantity(lineId, 4)
    expect(state().lines[0]).toMatchObject({ quantity: 4 })
    state().setQuantity(lineId, 0)
    expect(state().lines).toEqual([])
  })

  it('keeps each custom package separate, and edits, duplicates and removes them', () => {
    const first = state().addCustom([{ productId: 1, quantity: 2 }, { productId: 2, quantity: 0 }])
    const second = state().addCustom([{ productId: 1, quantity: 2 }])
    expect(state().lines).toHaveLength(2)
    expect(first).not.toBe(second)
    expect(state().lines[0]).toMatchObject({ kind: 'Custom', items: [{ productId: 1, quantity: 2 }] })

    state().updateCustom(first, [{ productId: 3, quantity: 5 }])
    expect(state().lines[0]).toMatchObject({ lineId: first, items: [{ productId: 3, quantity: 5 }] })

    state().duplicate(first)
    expect(state().lines).toHaveLength(3)
    expect(state().lines[1]).toMatchObject({ kind: 'Custom', items: [{ productId: 3, quantity: 5 }] })
    expect(state().lines[1].lineId).not.toBe(first)

    state().remove(first)
    expect(state().lines.map((l) => l.lineId)).not.toContain(first)
  })

  it('does not add an empty custom package', () => {
    expect(state().addCustom([{ productId: 1, quantity: 0 }])).toBe('')
    expect(state().lines).toEqual([])
  })

  it('persists ids and quantities only to localStorage', () => {
    state().addReadyMade(10, 'باقة الأسبوع', 2)

    const saved = JSON.parse(window.localStorage.getItem('dafa-cart')!)
    expect(saved.state.lines[0]).toEqual({ lineId: expect.any(String), kind: 'ReadyMade', packageId: 10, quantity: 2, name: 'باقة الأسبوع' })
    expect(JSON.stringify(saved)).not.toMatch(/price/i)
  })

  it('builds the checkout request without client-side prices', () => {
    state().addReadyMade(10, 'باقة', 2)
    state().addCustom([{ productId: 1, quantity: 3 }])

    expect(toCartRequest(state().lines)).toEqual([
      { lineId: expect.any(String), kind: 'ReadyMade', packageId: 10, quantity: 2 },
      { lineId: expect.any(String), kind: 'Custom', items: [{ productId: 1, quantity: 3 }] },
    ])
  })
})

describe('sanitizeLines (tampered or outdated localStorage)', () => {
  it('keeps valid lines and drops everything else', () => {
    const lines = sanitizeLines([
      { lineId: 'a', kind: 'ReadyMade', packageId: 1, quantity: 2, name: 'ok', price: 0.01 },
      { lineId: 'a', kind: 'ReadyMade', packageId: 2, quantity: 1 }, // duplicate id
      { lineId: 'b', kind: 'ReadyMade', packageId: -1, quantity: 1 },
      { lineId: 'c', kind: 'ReadyMade', packageId: 1, quantity: 1.5 },
      { lineId: 'd', kind: 'Custom', items: [{ productId: 1, quantity: 2 }, { productId: 1, quantity: 9 }, { productId: 'x', quantity: 1 }] },
      { lineId: 'e', kind: 'Custom', items: [] },
      { lineId: 'f', kind: 'Mystery' },
      'nonsense',
      null,
    ])

    expect(lines).toEqual([
      { lineId: 'a', kind: 'ReadyMade', packageId: 1, quantity: 2, name: 'ok' },
      { lineId: 'd', kind: 'Custom', items: [{ productId: 1, quantity: 2 }] },
    ])
  })

  it('returns an empty cart for non-arrays', () => {
    expect(sanitizeLines(undefined)).toEqual([])
    expect(sanitizeLines({ lines: [] })).toEqual([])
  })
})
