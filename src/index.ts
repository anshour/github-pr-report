// src/index.ts - Main entry point
import { fetchPRDetails, fetchPullRequests } from "./services/github";
import { exportToExcel } from "./services/excel";
import { CONFIG } from "./config";

function validateConfig() {
  const errors: string[] = [];

  if (!CONFIG.GITHUB_TOKEN) {
    errors.push("GITHUB_TOKEN is required");
  }

  if (!CONFIG.START_DATE) {
    errors.push("START_DATE is required");
  }

  if (!CONFIG.END_DATE) {
    errors.push("END_DATE is required");
  }

  if (!CONFIG.AUTHORS || CONFIG.AUTHORS.length === 0) {
    errors.push("GITHUB_AUTHORS is required (comma-separated list)");
  }

  if (!CONFIG.ORGANIZATION) {
    errors.push("GITHUB_ORGANIZATION is required");
  }

  if (errors.length > 0) {
    console.error("❌ Configuration errors:");
    errors.forEach((error) => console.error(`   - ${error}`));
    console.error("\n💡 Example usage:");
    console.error("   GITHUB_TOKEN=your_token \\");
    console.error("   START_DATE=2024-01-01 \\");
    console.error("   END_DATE=2024-06-30 \\");
    console.error("   GITHUB_AUTHORS=author1,author2 \\");
    console.error("   GITHUB_ORGANIZATION=your-org \\");
    console.error("   npm start");
    process.exit(1);
  }

  // Validate date format (should be YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(CONFIG.START_DATE)) {
    console.error(
      `❌ START_DATE must be in YYYY-MM-DD format, got: ${CONFIG.START_DATE}`
    );
    process.exit(1);
  }

  if (!dateRegex.test(CONFIG.END_DATE)) {
    console.error(
      `❌ END_DATE must be in YYYY-MM-DD format, got: ${CONFIG.END_DATE}`
    );
    process.exit(1);
  }

  console.log("✅ Configuration validated successfully");
  console.log(`📅 Date range: ${CONFIG.START_DATE} to ${CONFIG.END_DATE}`);
  console.log(`👥 Authors: ${CONFIG.AUTHORS.join(", ")}`);
  console.log(`🏢 Organization: ${CONFIG.ORGANIZATION}`);
}

async function main() {
  // Validate configuration first
  validateConfig();

  console.log(
    `🚀 Starting GitHub PR tracker for period: ${CONFIG.START_DATE} to ${CONFIG.END_DATE}`
  );

  try {
    const allPRs = await fetchPullRequests();

    const detailedPRs = await fetchPRDetails(allPRs);

    await exportToExcel(detailedPRs);
  } catch (error) {
    console.error("❌ Error in main process:", error);
  }
}

main();
