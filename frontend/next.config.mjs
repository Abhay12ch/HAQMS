import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Restricts Turbopack to only scan the frontend directory, resolving workspace root warnings
  turbopack: {
    root: '.',
  },
  // Configures Turbopack aliases for React and React-DOM
  turbo: {
    resolveAlias: {
      react: './node_modules/react',
      'react-dom': './node_modules/react-dom',
    }
  },
  webpack: (config) => {
    // Forces Webpack (default production fallback) to resolve React to the local frontend directory
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    };
    return config;
  }
};

export default nextConfig;


