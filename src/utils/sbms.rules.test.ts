import { canTransitionBooking, distanceKm } from './sbms.rules'

describe('SBMS booking rules', () => {
  it('only allows defined booking status transitions', () => {
    expect(canTransitionBooking('REQUESTED', 'CONFIRMED')).toBe(true)
    expect(canTransitionBooking('REQUESTED', 'DECLINED')).toBe(true)
    expect(canTransitionBooking('CONFIRMED', 'COMPLETED')).toBe(true)
    expect(canTransitionBooking('DECLINED', 'CONFIRMED')).toBe(false)
    expect(canTransitionBooking('COMPLETED', 'CANCELLED')).toBe(false)
  })

  it('calculates zero distance for the same coordinates and a positive distance otherwise', () => {
    expect(distanceKm(12.0, 37.0, 12.0, 37.0)).toBe(0)
    expect(distanceKm(12.0, 37.0, 12.1, 37.0)).toBeGreaterThan(10)
  })
})
