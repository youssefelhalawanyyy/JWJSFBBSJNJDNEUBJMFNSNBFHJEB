import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";

const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  disable: isDev,
  register: !isDev,
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
  serverExternalPackages: [
    "firebase-admin",
    "@google/generative-ai",
  ],
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
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
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default isDev ? nextConfig : withPWA(nextConfig);

