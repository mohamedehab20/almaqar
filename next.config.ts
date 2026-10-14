import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Attachments (approvals, notes, contracts…) go through a Server Action and may be up to 10 MB
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default withNextIntl(nextConfig);
