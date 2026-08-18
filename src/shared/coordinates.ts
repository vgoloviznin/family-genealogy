export interface GeoCoordinates {
  latitude: number
  longitude: number
}

export function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return ''
  return `${lat}, ${lng}`
}

export function parseCoordinates(text: string): GeoCoordinates | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

export function mapLink(coords: GeoCoordinates): string {
  const { latitude, longitude } = coords
  return `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17&l=map`
}
