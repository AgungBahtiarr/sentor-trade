export function calculateRiskReward(
  entry: number,
  stopLoss: number,
  takeProfit: number,
): number {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);

  if (risk === 0) return 0;
  return Number((reward / risk).toFixed(2));
}

interface PointOfInterest {
  price: number;
  strength?: number;
}

export function findNearestSupport(
  pois: PointOfInterest[],
  currentPrice: number,
): number | null {
  let nearest: PointOfInterest | null = null;
  let maxPrice = -Infinity;

  for (const poi of pois) {
    if (poi.price < currentPrice && poi.price > maxPrice) {
      maxPrice = poi.price;
      nearest = poi;
    }
  }

  return nearest ? nearest.price : null;
}

export function findNearestResistance(
  pois: PointOfInterest[],
  currentPrice: number,
): number | null {
  let nearest: PointOfInterest | null = null;
  let minPrice = Infinity;

  for (const poi of pois) {
    if (poi.price > currentPrice && poi.price < minPrice) {
      minPrice = poi.price;
      nearest = poi;
    }
  }

  return nearest ? nearest.price : null;
}
