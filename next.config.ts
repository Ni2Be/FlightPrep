import type { NextConfig } from "next";

// This app ships in two modes from the same source:
//  - Static export, deployed to GitHub Pages (a *project* site at
//    https://ni2be.github.io/FlightPrep/, hence the "/FlightPrep" prefix).
//    No server, so no API routes — that's why NOTAMs are "hosted mode only".
//  - A normal ("hosted") Next.js build/dev server, which DOES support the
//    `/api/notams` route handler. Use this when running your own instance
//    (e.g. `npm run dev`, or `npm run build && npm start` somewhere with a
//    persistent Node process).
// `npm run build:pages` sets GITHUB_PAGES=true and builds the static export;
// plain `npm run build`/`npm run dev` are the hosted build.
const isGithubPagesBuild = process.env.GITHUB_PAGES === "true";
const repoBasePath = "/FlightPrep";

const nextConfig: NextConfig = {
  ...(isGithubPagesBuild ? { output: "export" as const } : {}),
  // Only needed for the static export (plain file server, no rewrite rules).
  // In hosted mode it just adds a pointless redirect — and breaks query
  // strings on /api routes along the way — so leave Next's default (false).
  trailingSlash: isGithubPagesBuild,
  basePath: isGithubPagesBuild ? repoBasePath : "",
  assetPrefix: isGithubPagesBuild ? repoBasePath : "",
  images: {
    unoptimized: true,
  },
  env: {
    // Exposed to client code so links/fetches to /data/** can be built correctly
    // regardless of whether the site is served from "/" or "/FlightPrep/".
    NEXT_PUBLIC_BASE_PATH: isGithubPagesBuild ? repoBasePath : "",
    // Lets client components (e.g. NotamPanel) know whether /api/notams
    // actually exists in this build.
    NEXT_PUBLIC_HOSTED_MODE: isGithubPagesBuild ? "false" : "true",
  },
};

export default nextConfig;
