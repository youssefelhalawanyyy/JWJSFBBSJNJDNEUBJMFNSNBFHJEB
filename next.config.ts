import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "sonner",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "clsx",
      "tailwind-merge",
      "chart.js",
      "react-chartjs-2",
      "exceljs",
      "jspdf",
      "jspdf-autotable",
      "papaparse",
      "canvas-confetti",
      "@tanstack/react-table",
      "react-hot-toast",
      "swr",
      "idb",
      "html5-qrcode",
      "qrcode",
      "react-qr-code",
      "lottie-react",
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
      "firebase/messaging"
    ],
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|png|webp|ico|woff|woff2|ttf|mp3|webmanifest)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/financials/inputs/overview",
        destination: "/financials/inputs",
        permanent: true,
      },
    ];
  },
  turbopack: {},
};

export default withPWA(nextConfig);

