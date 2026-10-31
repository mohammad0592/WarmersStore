import { describe, expect, it } from 'vitest'
import { composePhone } from './phone'

describe('composePhone', () => {
  it.each([
    ['+970', '0599 123 456', '+970599123456'],
    ['+970', '599-123-456', '+970599123456'],
    ['+970', '٠٥٩٩١٢٣٤٥٦', '+970599123456'],
    ['+972', '052 123 4567', '+972521234567'],
    ['+970', '+44 7700 900123', '+447700900123'], // a full number wins over the selected code
    ['+970', '0044 7700 900123', '+447700900123'],
    ['other', '+1 (415) 555-0100', '+14155550100'],
  ] as const)('%s + %s → %s', (code, input, expected) => {
    expect(composePhone(code, input)).toBe(expected)
  })

  it.each([
    ['+970', ''],
    ['+970', '05x9123456'],
    ['+970', '12'],
    ['other', '0599123456'], // another country needs the full international number
  ] as const)('rejects %s + %s', (code, input) => {
    expect(composePhone(code, input)).toBeNull()
  })
})
