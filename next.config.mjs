import os from "node:os";

const isWsl = process.platform === "linux"
  && (
    Boolean(process.env.WSL_DISTRO_NAME)
    || os.release().toLowerCase().includes("microsoft")
  );

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@github/copilot-sdk', '@github/copilot'],
  distDir: process.env.NEXT_DIST_DIR || (isWsl ? ".next-wsl" : ".next"),
};

export default nextConfig;
