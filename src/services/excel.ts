// src/services/excel.ts - Excel export functionality
import * as ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "../config";
import {
  formatDate,
  formatDateTime,
  getCurrentDateTime,
  getFileTimestamp,
} from "../utils/date";
import type { AuthorStats, PullRequestInfo, RepoStats } from "../types";

/**
 * Export PR data to Excel file with summary and details
 */
export async function exportToExcel(prs: PullRequestInfo[]): Promise<void> {
  console.log(`🔍 Processing ${prs.length} pull requests for Excel file...`);

  const workbook = createWorkbook();

  // Create worksheets
  const worksheetPRs = createPRsWorksheet(workbook, prs);
  const worksheetSummary = createSummaryWorksheet(workbook, prs);

  // Ensure output directory exists
  ensureOutputDirectoryExists();

  // Save workbook
  const fileName = `github_prs_${getFileTimestamp()}.xlsx`;
  const filePath = path.join(CONFIG.OUTPUT_DIR, fileName);

  try {
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Excel file created successfully: ${fileName}`);
  } catch (error) {
    console.error("❌ Error saving Excel file:", error);
  }
}

/**
 * Create a new workbook with metadata
 */
function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GitHub PR Tracker";
  workbook.created = new Date();
  return workbook;
}

/**
 * Create the main PR details worksheet
 */
function createPRsWorksheet(
  workbook: ExcelJS.Workbook,
  prs: PullRequestInfo[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet("Pull Requests");

  // Add headers
  worksheet.columns = [
    { header: "Project", key: "project", width: 10 },
    { header: "Judul", key: "title", width: 50 },
    { header: "Deskripsi", key: "description", width: 75 },
    { header: "Author", key: "author", width: 20 },
    { header: "URL", key: "url", width: 50 },
    { header: "Baris Ditambahkan", key: "additions", width: 20 },
    { header: "Baris Dihapus", key: "deletions", width: 20 },
    { header: "Total Perubahan", key: "total", width: 20 },
    { header: "Tanggal Buat", key: "created_at", width: 20 },
    { header: "Tanggal Merge", key: "closed_at", width: 20 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true };

  // Add data
  prs.forEach((pr) => {
    const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
    worksheet.addRow({
      project: pr.project,
      title: pr.title,
      description: pr.description,
      author: pr.user.login,
      url: pr.html_url,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      total: totalChanges || "N/A",
      created_at: pr.created_at,
      closed_at: pr.closed_at,
    });
  });

  return worksheet;
}

/**
 * Create the summary worksheet with statistics
 */
function createSummaryWorksheet(
  workbook: ExcelJS.Workbook,
  prs: PullRequestInfo[]
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet("Summary");

  // Setup columns
  worksheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 20 },
    { header: "", key: "c", width: 20 },
    { header: "", key: "d", width: 20 },
    { header: "", key: "e", width: 20 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true };

  // Report period
  addSectionHeader(worksheet, "Periode Laporan");
  worksheet.addRow({
    metric: "Tanggal Mulai",
    value: formatDate(CONFIG.START_DATE),
  });
  worksheet.addRow({
    metric: "Tanggal Akhir",
    value: formatDate(CONFIG.END_DATE),
  });

  // Add generation metadata
  worksheet.addRow({});
  worksheet.addRow({
    metric: "Tanggal Pembuatan Laporan",
    value: getCurrentDateTime(),
  });
  worksheet.addRow({});

  // PR summary
  addSectionHeader(worksheet, "Ringkasan Pull Request");

  // Calculate totals
  const totalAdditions = prs.reduce((sum, pr) => sum + (pr.additions || 0), 0);
  const totalDeletions = prs.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
  const totalChanges = totalAdditions + totalDeletions;

  worksheet.addRow({
    metric: "Total Pull Requests",
    value: prs.length,
  });
  worksheet.addRow({
    metric: "Total Penambahan Kode",
    value: totalAdditions,
  });
  worksheet.addRow({
    metric: "Total Penghapusan Kode",
    value: totalDeletions,
  });
  worksheet.addRow({
    metric: "Total Perubahan Kode",
    value: totalChanges,
  });
  worksheet.addRow({});

  // Author statistics
  addAuthorStatistics(worksheet, prs);

  // Top 5 PRs with most changes
  addTopChangedPRs(worksheet, prs);

  // Top 5 repos with most changes
  addTopReposByChanges(worksheet, prs);

  return worksheet;
}

/**
 * Add author statistics section to summary
 */
function addAuthorStatistics(
  worksheet: ExcelJS.Worksheet,
  prs: PullRequestInfo[]
): void {
  addSectionHeader(worksheet, "Ringkasan Per Author");

  // Add table header
  const headerRow = worksheet.addRow({
    metric: "Author",
    value: "Jumlah PR",
  });
  worksheet.getCell(`C${worksheet.rowCount}`).value = "Penambahan Kode";
  worksheet.getCell(`D${worksheet.rowCount}`).value = "Penghapusan Kode";
  worksheet.getCell(`E${worksheet.rowCount}`).value = "Total Perubahan";
  headerRow.font = { bold: true };

  // Calculate author stats
  const authorStats = calculateAuthorStats(prs);

  // Sort authors by total changes (descending)
  const sortedAuthorStats = authorStats.sort(
    (a, b) => b.authorChanges - a.authorChanges
  );

  // Add author data
  sortedAuthorStats.forEach((stat) => {
    const rowNum = worksheet.rowCount + 1;
    worksheet.addRow({
      metric: stat.author,
      value: stat.prCount,
    });
    worksheet.getCell(`C${rowNum}`).value = stat.authorAdditions;
    worksheet.getCell(`D${rowNum}`).value = stat.authorDeletions;
    worksheet.getCell(`E${rowNum}`).value = stat.authorChanges;
  });

  worksheet.addRow({});
}

/**
 * Add top PRs with most changes section
 */
function addTopChangedPRs(
  worksheet: ExcelJS.Worksheet,
  prs: PullRequestInfo[]
): void {
  addSectionHeader(worksheet, "Top 5 PR dengan Perubahan Terbanyak");

  // Add table header
  const headerRow = worksheet.addRow({
    metric: "Judul PR",
    value: "Author",
  });
  worksheet.getCell(`C${worksheet.rowCount}`).value = "Total Perubahan";
  worksheet.getCell(`D${worksheet.rowCount}`).value = "Tanggal Merge";
  worksheet.getCell(`E${worksheet.rowCount}`).value = "URL";
  headerRow.font = { bold: true };

  // Get top 5 PRs by changes
  const top5PRs = getTopPRsByChanges(prs, 5);

  // Add PR data
  top5PRs.forEach((pr) => {
    const rowNum = worksheet.rowCount + 1;
    worksheet.addRow({
      metric: pr.title,
      value: pr.user.login,
    });
    worksheet.getCell(`C${rowNum}`).value =
      (pr.additions || 0) + (pr.deletions || 0);
    worksheet.getCell(`D${rowNum}`).value = pr.closed_at;
    worksheet.getCell(`E${rowNum}`).value = pr.html_url;
  });

  worksheet.addRow({});
}

/**
 * Add top repos with most changes section
 */
function addTopReposByChanges(
  worksheet: ExcelJS.Worksheet,
  prs: PullRequestInfo[]
): void {
  addSectionHeader(worksheet, "Top 5 Repo Berdasarkan Jumlah Perubahan");

  // Add table header
  const headerRow = worksheet.addRow({
    metric: "Repo",
    value: "Total Perubahan",
  });
  headerRow.font = { bold: true };

  // Get top 5 repos by changes
  const top5Repos = getTopReposByChanges(prs, 5);

  // Add repo data
  top5Repos.forEach((repoStat) => {
    worksheet.addRow({
      metric: repoStat.repo,
      value: repoStat.changes,
    });
  });
}

/**
 * Helper function to add section headers
 */
function addSectionHeader(worksheet: ExcelJS.Worksheet, title: string): void {
  const row = worksheet.addRow({
    metric: title,
    value: "",
  });
  row.font = { bold: true };
}

/**
 * Calculate statistics for all authors
 */
function calculateAuthorStats(prs: PullRequestInfo[]): AuthorStats[] {
  return CONFIG.AUTHORS.map((author) => {
    const authorPRs = prs.filter((pr) => pr.user.login === author);
    const prCount = authorPRs.length;
    const authorAdditions = authorPRs.reduce(
      (sum, pr) => sum + (pr.additions || 0),
      0
    );
    const authorDeletions = authorPRs.reduce(
      (sum, pr) => sum + (pr.deletions || 0),
      0
    );
    const authorChanges = authorAdditions + authorDeletions;

    return {
      author,
      prCount,
      authorAdditions,
      authorDeletions,
      authorChanges,
    };
  });
}

/**
 * Get top PRs by number of changes
 */
function getTopPRsByChanges(
  prs: PullRequestInfo[],
  limit: number
): PullRequestInfo[] {
  return [...prs]
    .filter(
      (pr) =>
        typeof pr.additions === "number" && typeof pr.deletions === "number"
    )
    .sort((a, b) => b.additions! + b.deletions! - (a.additions! + a.deletions!))
    .slice(0, limit);
}

/**
 * Get top repos by number of changes
 */
function getTopReposByChanges(
  prs: PullRequestInfo[],
  limit: number
): RepoStats[] {
  const repoChangesMap: Record<string, number> = {};

  prs.forEach((pr) => {
    const totalChange = (pr.additions || 0) + (pr.deletions || 0);
    if (!repoChangesMap[pr.project]) {
      repoChangesMap[pr.project] = 0;
    }
    repoChangesMap[pr.project]! += totalChange;
  });

  return Object.entries(repoChangesMap)
    .map(([repo, changes]) => ({ repo, changes }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, limit);
}

/**
 * Ensure output directory exists
 */
function ensureOutputDirectoryExists(): void {
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }
}
