import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  // Page-data collection runs one worker per core by default, which exhausts
  // memory on small build machines. Opt in with NEXT_BUILD_CPUS=2; unset, the
  // build behaves exactly as before.
  ...(Number(process.env.NEXT_BUILD_CPUS) > 0
    ? { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } }
    : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
