/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Static export so the app can be served from GitHub Pages (no Node server).
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  sassOptions: { includePaths: ["./src/styles"] },
};

export default nextConfig;
