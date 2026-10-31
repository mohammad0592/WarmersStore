import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { formatMoney, whatsAppChatUrl } from '@/lib/format'
import { QuantityStepper } from './QuantityStepper'

function Stepper({ min, max }: { min: number; max: number }) {
  const [value, setValue] = useState(min)
  return <QuantityStepper label="باقة الأسبوع" max={max} min={min} onChange={setValue} value={value} />
}

describe('QuantityStepper', () => {
  it('steps within its bounds and disables the buttons at the limits', () => {
    render(<Stepper max={2} min={1} />)
    const decrease = screen.getByRole('button', { name: 'تقليل الكمية: باقة الأسبوع' })
    const increase = screen.getByRole('button', { name: 'زيادة الكمية: باقة الأسبوع' })

    expect(decrease).toBeDisabled()
    fireEvent.click(increase)
    expect(screen.getByRole('status')).toHaveTextContent('2')
    expect(increase).toBeDisabled()
    fireEvent.click(decrease)
    expect(screen.getByRole('status')).toHaveTextContent('1')
  })
})

describe('format', () => {
  it.each([
    [49, '49 ₪'],
    [12.5, '12.50 ₪'],
    [0.1 + 0.2, '0.30 ₪'],
    [0, '0 ₪'],
  ])('formats %s as %s', (amount, expected) => {
    expect(formatMoney(amount)).toBe(expected)
  })

  it('builds wa.me links from E.164 numbers', () => {
    expect(whatsAppChatUrl('+970 599-000-000')).toBe('https://wa.me/970599000000')
    expect(whatsAppChatUrl(null)).toBeNull()
    expect(whatsAppChatUrl('')).toBeNull()
  })
})
