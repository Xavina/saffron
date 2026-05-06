/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@github/copilot-sdk', '@github/copilot'],
};

export default nextConfig;
