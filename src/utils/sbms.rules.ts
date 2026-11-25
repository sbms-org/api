import { SbmsBooking } from '../Entities/sbms'

export const bookingTransitions: Record<SbmsBooking['status'], SbmsBooking['status'][]> = {
  REQUESTED: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'COMPLETED'],
  DECLINED: [],
  CANCELLED: [],
  COMPLETED: [],
}

export const canTransitionBooking = (from: SbmsBooking['status'], to: string): to is SbmsBooking['status'] => {
  return bookingTransitions[from]?.includes(to as SbmsBooking['status']) ?? false
}

export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const dLat = radians(lat2 - lat1)
  const dLon = radians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
