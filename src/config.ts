export const CONFIG = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  START_DATE: process.env.START_DATE || "",
  END_DATE: process.env.END_DATE || "",
  AUTHORS: process.env.GITHUB_AUTHORS?.split(",") || [],
  ORGANIZATION: process.env.GITHUB_ORGANIZATION || "",
  EXCLUDED_FILES: [
    // Lock files
    "package-lock.json",
    "composer.lock",
    "yarn.lock",
    "pnpm-lock.yaml",
    // Generated files & binaries
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".pdf",
    ".zip",
    ".ttf",
    ".woff",
    ".woff2",
    ".eot",
    // Build outputs
    "dist/",
    "build/",
    "public/build/",
    // Minified files
    ".min.js",
    ".min.css",
    // Translation files
    ".po",
    ".mo",
    // Data files
    ".csv",
  ],
  OUTPUT_DIR: "output",
};
