// src/index.ts - Main entry point
import { fetchPRDetails, fetchPullRequests } from "./services/github";
import { exportToExcel } from "./services/excel";
import { CONFIG } from "./config";

async function main() {
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
