/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Otimizações para uso mínimo de recursos
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false, // Reduz overhead em desenvolvimento
  
  // Otimizações de build
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  
  // Configuração do Turbopack (Next.js 16+)
  turbopack: {
    root: '/home/adm-system/Documents/crypto-monorepo/frontend',
  },
  
  // Configurações de memória
  webpack: (config, { dev }) => {
    if (dev) {
      // Reduz uso de memória em desenvolvimento
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    // Otimiza bundle
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      minimize: true,
    }
    return config
  },
}

export default nextConfig

