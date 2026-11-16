export const STANDARD_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export function satelliteTiles() {
  const key=process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
  const custom=process.env.NEXT_PUBLIC_SATELLITE_TILE_URL;
  const attribution=process.env.NEXT_PUBLIC_SATELLITE_ATTRIBUTION;
  if (custom && attribution && !/google\./i.test(custom)) {
    try {
      const parsed = new URL(custom.replace(/\{[^}]+\}/g,"0"));
      if (parsed.protocol==="https:" && !parsed.username && !parsed.password && ["{z}","{x}","{y}"].every(token=>custom.includes(token))) return {url:custom,attribution};
    } catch { /* Optional invalid configuration falls back to Standard. */ }
  }
  if (key) return {url:`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`,attribution:'&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'};
  return null;
}
