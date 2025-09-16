/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Reduce chances of stale dev cache causing missing chunk errors.
    if (dev) config.cache = false
    return config
  },
}

export default nextConfig
