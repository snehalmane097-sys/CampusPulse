const { outputDirectory } = require("./scripts/next-output.cjs");
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  cleanDistDir: true,
  async headers() {
    const storageOrigin = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).origin : 'https://s3.' + (process.env.AWS_REGION || 'us-east-1') + '.amazonaws.com';
    const mapOrigins = ['https://tile.openstreetmap.org', 'https://api.maptiler.com'];
    if (process.env.NEXT_PUBLIC_SATELLITE_TILE_URL) {
      try {
        const configured = new URL(process.env.NEXT_PUBLIC_SATELLITE_TILE_URL.replace(/\{[^}]+\}/g, '0'));
        if (configured.protocol === 'https:') mapOrigins.push(configured.origin);
      } catch { /* Invalid optional imagery must not break the standard map/build. */ }
    }
    const mapSources = mapOrigins.join(' ');
    const policy = ["default-src 'self'", "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''), "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com", "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data: blob: https://*.basemaps.cartocdn.com " + mapSources + " " + storageOrigin, "media-src 'self' blob: " + storageOrigin, "connect-src 'self' " + storageOrigin + (process.env.NODE_ENV !== 'production' ? ' ws://localhost:*' : ''), "frame-src 'self' " + storageOrigin, "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: policy }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' }, ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : [])] }, { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }];
  },
};
module.exports = phase => ({
  ...nextConfig,
  distDir: outputDirectory(phase),
  // npm prebuild already cleans and serially prepares route directories on Windows.
  // Preserve that prepared tree when production workers start; stale output is not retained.
  cleanDistDir: phase === require("next/constants").PHASE_DEVELOPMENT_SERVER,
});
