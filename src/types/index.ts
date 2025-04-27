export interface BookingStatus {
  bookingCode: string
  position: number | null
  telegramStatus?: string
}

export interface TrackingOptions {
  onStatusUpdate: (status: BookingStatus) => void
  onError: (error: Error) => void
}
