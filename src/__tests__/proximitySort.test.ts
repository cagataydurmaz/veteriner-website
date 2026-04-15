import { describe, it, expect } from 'vitest';

// ── Extracted from src/app/veteriner-bul/client.tsx ──────────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  "Adana": [37.0, 35.3213], "Adıyaman": [37.7648, 38.2786],
  "Afyonkarahisar": [38.7507, 30.5567], "Ağrı": [39.7191, 43.0503],
  "Amasya": [40.6499, 35.8353], "Ankara": [39.9334, 32.8597],
  "Antalya": [36.8969, 30.7133], "Artvin": [41.1828, 41.8183],
  "Aydın": [37.856, 27.8416], "Balıkesir": [39.6484, 27.8826],
  "İstanbul": [41.0082, 28.9784], "İzmir": [38.4192, 27.1287],
  "Bursa": [40.1885, 29.061], "Eskişehir": [39.7767, 30.5206],
  "Konya": [37.8746, 32.4932], "Kocaeli": [40.8533, 29.8815],
};

/** Haversine distance in km between two WGS-84 coordinates */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Simplified vet type for sorting tests ────────────────────────────────────
interface SimpleVet {
  id: string;
  city: string;
  average_rating: number | null;
}

function sortByProximity(
  vets: SimpleVet[],
  userLat: number,
  userLng: number
): SimpleVet[] {
  return [...vets].sort((a, b) => {
    const coordsA = CITY_COORDS[a.city];
    const coordsB = CITY_COORDS[b.city];
    if (!coordsA && !coordsB) return (b.average_rating ?? 0) - (a.average_rating ?? 0);
    if (!coordsA) return 1;
    if (!coordsB) return -1;
    const distA = haversineKm(userLat, userLng, coordsA[0], coordsA[1]);
    const distB = haversineKm(userLat, userLng, coordsB[0], coordsB[1]);
    if (Math.abs(distA - distB) < 30) return (b.average_rating ?? 0) - (a.average_rating ?? 0);
    return distA - distB;
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  it('distance İstanbul → Ankara should be approximately 350km', () => {
    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const [ankLat, ankLon] = CITY_COORDS['Ankara'];
    const dist = haversineKm(istLat, istLon, ankLat, ankLon);
    // Actual road distance is ~450km, straight line is ~350km
    expect(dist).toBeGreaterThan(300);
    expect(dist).toBeLessThan(450);
  });

  it('distance same city → 0', () => {
    const [lat, lon] = CITY_COORDS['İstanbul'];
    const dist = haversineKm(lat, lon, lat, lon);
    expect(dist).toBe(0);
  });

  it('distance İzmir → Ankara should be approximately 500km', () => {
    const [izmLat, izmLon] = CITY_COORDS['İzmir'];
    const [ankLat, ankLon] = CITY_COORDS['Ankara'];
    const dist = haversineKm(izmLat, izmLon, ankLat, ankLon);
    expect(dist).toBeGreaterThan(400);
    expect(dist).toBeLessThan(600);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const [ankLat, ankLon] = CITY_COORDS['Ankara'];
    const distAB = haversineKm(istLat, istLon, ankLat, ankLon);
    const distBA = haversineKm(ankLat, ankLon, istLat, istLon);
    expect(distAB).toBeCloseTo(distBA, 5);
  });

  it('returns positive distance for different cities', () => {
    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const [izmLat, izmLon] = CITY_COORDS['İzmir'];
    const dist = haversineKm(istLat, istLon, izmLat, izmLon);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('Proximity sort', () => {
  it('user in İstanbul: İstanbul vet should be first among [Ankara, İstanbul, İzmir]', () => {
    const vets: SimpleVet[] = [
      { id: '1', city: 'Ankara', average_rating: 4.5 },
      { id: '2', city: 'İstanbul', average_rating: 4.0 },
      { id: '3', city: 'İzmir', average_rating: 4.8 },
    ];

    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const sorted = sortByProximity(vets, istLat, istLon);

    expect(sorted[0].city).toBe('İstanbul');
  });

  it('vet in same city (dist=0) wins over vets in distant cities', () => {
    const vets: SimpleVet[] = [
      { id: '1', city: 'Ankara', average_rating: 5.0 },
      { id: '2', city: 'İzmir', average_rating: 5.0 },
      { id: '3', city: 'İstanbul', average_rating: 3.0 },
    ];

    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const sorted = sortByProximity(vets, istLat, istLon);

    expect(sorted[0].city).toBe('İstanbul');
  });

  it('within same city, higher rated vet comes first (tie-break)', () => {
    const vets: SimpleVet[] = [
      { id: '1', city: 'İstanbul', average_rating: 3.0 },
      { id: '2', city: 'İstanbul', average_rating: 5.0 },
    ];

    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const sorted = sortByProximity(vets, istLat, istLon);

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });

  it('closer city comes before farther city for user in İstanbul', () => {
    // Bursa (~80km) should be closer to İstanbul than Ankara (~350km)
    const vets: SimpleVet[] = [
      { id: '1', city: 'Ankara', average_rating: 5.0 },
      { id: '2', city: 'Bursa', average_rating: 3.0 },
    ];

    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const sorted = sortByProximity(vets, istLat, istLon);

    expect(sorted[0].city).toBe('Bursa');
    expect(sorted[1].city).toBe('Ankara');
  });

  it('vet with no known city coords sinks to end', () => {
    const vets: SimpleVet[] = [
      { id: '1', city: 'UnknownCity', average_rating: 5.0 },
      { id: '2', city: 'İstanbul', average_rating: 1.0 },
    ];

    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const sorted = sortByProximity(vets, istLat, istLon);

    expect(sorted[0].city).toBe('İstanbul');
    expect(sorted[1].city).toBe('UnknownCity');
  });

  it('two vets with unknown city are sorted by rating descending', () => {
    const vets: SimpleVet[] = [
      { id: '1', city: 'Unknown1', average_rating: 3.0 },
      { id: '2', city: 'Unknown2', average_rating: 5.0 },
    ];

    const [istLat, istLon] = CITY_COORDS['İstanbul'];
    const sorted = sortByProximity(vets, istLat, istLon);

    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });
});
