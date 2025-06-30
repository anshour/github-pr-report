// src/services/github.ts - GitHub API communication (modified to return data)
import * as https from "https";
import { CONFIG } from "../config";
import { formatDate } from "../utils/date";
import type { FileChange, PullRequestInfo } from "../types";

/**
 * Fetches basic pull request information for all authors
 * @returns Promise that resolves to array of pull requests
 */
export async function fetchPullRequests(): Promise<PullRequestInfo[]> {
  console.log(
    `🚀 Starting to fetch PRs for ${CONFIG.AUTHORS.length} authors...`
  );

  // Process authors sequentially to avoid rate limiting
  const allPRs: PullRequestInfo[] = [];

  for (const author of CONFIG.AUTHORS) {
    try {
      const authorPRs = await fetchAuthorPRs(author);
      allPRs.push(...authorPRs);

      // Add delay between authors to respect rate limits
      if (CONFIG.AUTHORS.indexOf(author) < CONFIG.AUTHORS.length - 1) {
        console.log(`⏳ Waiting 1 second before processing next author...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ Failed to fetch PRs for ${author}:`, error);
    }
  }

  console.log(
    `📝 Found total ${allPRs.length} pull requests across all authors`
  );

  // Log summary by author
  const authorCounts = CONFIG.AUTHORS.map((author) => {
    const count = allPRs.filter((pr) => pr.user.login === author).length;
    return `${author}: ${count}`;
  });
  console.log(`📊 PR count by author: ${authorCounts.join(", ")}`);

  return allPRs;
}

/**
 * Fetches PRs for a specific author with pagination support
 */
async function fetchAuthorPRs(author: string): Promise<PullRequestInfo[]> {
  console.log(`🔍 Fetching ${author}'s pull requests`);

  // Debug the query construction
  if (CONFIG.AUTHORS.indexOf(author) === 0) {
    debugQuery(author);
  }

  let allPRs: PullRequestInfo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const encodedQuery = encodeURIComponent(
      `org:${CONFIG.ORGANIZATION} is:pr author:${author} created:${CONFIG.START_DATE}..${CONFIG.END_DATE}`
    );

    const options: https.RequestOptions = {
      hostname: "api.github.com",
      path: `/search/issues?q=${encodedQuery}&per_page=${perPage}&page=${page}`,
      method: "GET",
      headers: getGitHubHeaders(),
    };

    try {
      const data = await makeHttpRequest(options);
      const result = JSON.parse(data);

      if (result.items && Array.isArray(result.items)) {
        const prs = result.items.map((pr: any) => ({
          number: pr.number,
          created_at: formatDate(pr.created_at),
          closed_at: formatDate(pr.closed_at),
          title: pr.title,
          user: { login: pr.user.login },
          html_url: pr.html_url,
        }));

        allPRs = allPRs.concat(prs);

        // Log progress
        console.log(
          `📄 Page ${page}: Found ${prs.length} PRs for ${author} (Total: ${allPRs.length})`
        );

        // Check if we've reached the end or hit GitHub's limit
        if (
          result.items.length < perPage ||
          allPRs.length >= result.total_count ||
          page >= 10
        ) {
          if (allPRs.length >= result.total_count) {
            console.log(
              `✅ Retrieved all ${result.total_count} PRs for ${author}`
            );
          } else if (page >= 10) {
            console.log(
              `⚠️  Reached page limit (10) for ${author}. Total retrieved: ${allPRs.length}/${result.total_count}`
            );
          }
          break;
        }

        page++;

        // Add small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        console.error(
          `❌ Invalid response for author ${author} (page ${page}):`,
          result
        );
        if (result.message) {
          console.error(`   Error message: ${result.message}`);
        }
        break;
      }
    } catch (error) {
      console.error(
        `❌ Error fetching PRs for author ${author} (page ${page}):`,
        error
      );
      break;
    }
  }

  console.log(`🎯 Total PRs found for ${author}: ${allPRs.length}`);
  return allPRs;
}

/**
 * Fetches detailed information for a collection of PRs
 * @returns Promise that resolves to array of PRs with detailed information
 */
export async function fetchPRDetails(
  prs: PullRequestInfo[]
): Promise<PullRequestInfo[]> {
  if (prs.length === 0) {
    console.log("🔍 No pull requests found.");
    return [];
  }

  console.log(`🔍 Fething ${prs.length} pull request details...`);

  // Process each PR with small delays to avoid rate limiting
  const detailedPRs = JSON.parse(JSON.stringify(prs)) as PullRequestInfo[];
  const processedPRs: (PullRequestInfo | null)[] = [];

  for (let i = 0; i < detailedPRs.length; i++) {
    const pr = detailedPRs[i]!;
    console.log(
      `🔍 Processing PR ${i + 1}/${detailedPRs.length}: #${pr.number}`
    );

    const enrichedPR = await enrichPRWithDetails(pr);
    processedPRs.push(enrichedPR);

    // Add small delay between PRs to avoid rate limiting
    if (i < detailedPRs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const filteredPRs = processedPRs.filter((pr) => pr !== null);

  // Filter out any PRs that should be excluded
  return filteredPRs;
}

/**
 * Enriches a single PR with detailed information
 * @returns The enriched PR or null if it should be excluded
 */
async function enrichPRWithDetails(
  pr: PullRequestInfo
): Promise<PullRequestInfo | null> {
  try {
    const { owner, repo } = extractRepoInfo(pr.html_url);
    const prNumber = pr.number;

    // Add repository name to PR
    pr.project = repo;

    // Fetch PR details to get state and merged_at
    const prDetailData = await fetchPRDetail(owner, repo, prNumber);
    const head = prDetailData.head?.ref?.toLowerCase();
    const base = prDetailData.base?.ref?.toLowerCase();

    // Filter PR yang tidak open dan tidak merged
    const isOpen = prDetailData.state === "open";
    const isMerged = prDetailData.merged_at !== null;
    if (!isOpen && !isMerged) {
      return null;
    }

    pr.head = head;
    pr.base = base;

    if (shouldSkipPR(head, base)) {
      return null;
    }

    const filesData = await fetchPRFiles(owner, repo, prNumber);
    // const commentsData = await fetchPRComments(owner, repo, prNumber);
    const changes = calculateCodeChanges(filesData);
    pr.additions = changes.additions;
    pr.deletions = changes.deletions;
    // pr.description = commentsData[0]?.body;

    return pr;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If it's a rate limit error, return the PR with basic info but no file changes
    if (errorMessage.includes("HTTP Error: 403")) {
      console.warn(
        `⚠️  Rate limit hit for PR #${pr.number}, returning basic info without file changes`
      );
      pr.additions = 0;
      pr.deletions = 0;
      return pr;
    }

    console.error(`❌ Error processing PR #${pr.number}:`, error);
    return pr;
  }
}

/**
 * Fetches details for a single PR
 */
async function fetchPRDetail(
  owner: string,
  repo: string,
  prNumber: number
): Promise<any> {
  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
    method: "GET",
    headers: getGitHubHeaders(),
  };

  const data = await makeHttpRequest(options);
  return JSON.parse(data);
}

/**
 * Fetches files changed in a PR
 */
/**
 * Fetches files changed in a PR
 */
async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<FileChange[]> {
  let page = 1;
  let allFiles: FileChange[] = [];

  while (true) {
    try {
      const options: https.RequestOptions = {
        hostname: "api.github.com",
        path: `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
        method: "GET",
        headers: getGitHubHeaders(),
      };

      const data = await makeHttpRequest(options);
      const files = JSON.parse(data);

      if (!Array.isArray(files)) {
        console.warn(
          `⚠️  Invalid or empty file response for PR #${prNumber}, skipping...`
        );
        break;
      }

      allFiles = allFiles.concat(files);
      if (files.length < 100) break; // No more pages

      page++;
    } catch (error) {
      console.error(
        `❌ Error fetching files (page ${page}) for PR #${prNumber}:`,
        error
      );
      break;
    }
  }

  return allFiles;
}

/**
 * Fetches files changed in a PR
 */
async function fetchPRComments(
  owner: string,
  repo: string,
  prNumber: number
): Promise<any[]> {
  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path: `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
    method: "GET",
    headers: getGitHubHeaders(),
  };

  try {
    const data = await makeHttpRequest(options);
    const comments = JSON.parse(data);

    if (Array.isArray(comments)) {
      return comments;
    } else {
      console.error(`❌ Invalid file response for PR #${prNumber}`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error fetching files for PR #${prNumber}:`, error);
    return [];
  }
}

/**
 * Helper function to make HTTP requests that returns a Promise with better rate limit handling
 */
function makeHttpRequest(
  options: https.RequestOptions,
  retryCount = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        // Check for HTTP error status codes
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          if (res.statusCode === 403) {
            console.warn(`⚠️  Rate limit hit (403). Response: ${data}`);

            // Parse rate limit headers if available
            const resetTime = res.headers["x-ratelimit-reset"];
            if (resetTime) {
              const resetDate = new Date(parseInt(resetTime as string) * 1000);
              const waitTime = Math.max(0, resetDate.getTime() - Date.now());
              console.warn(
                `⏰ Rate limit resets at: ${resetDate.toISOString()}`
              );

              // If this is the first retry and we have a reasonable wait time (less than 10 minutes)
              if (retryCount === 0 && waitTime < 600000) {
                const waitSeconds = Math.ceil(waitTime / 1000) + 5; // Add 5 seconds buffer
                console.log(
                  `⏳ Waiting ${waitSeconds} seconds for rate limit to reset...`
                );

                setTimeout(() => {
                  makeHttpRequest(options, retryCount + 1)
                    .then(resolve)
                    .catch(reject);
                }, waitTime + 5000); // Add 5 seconds buffer
                return;
              }
            }

            // If we can't or shouldn't retry, return empty response instead of crashing
            console.warn(
              `⚠️  Skipping request due to rate limit. Returning empty response.`
            );
            resolve('{"items": [], "total_count": 0}');
            return;
          }
          reject(new Error(`HTTP Error: ${res.statusCode} - ${data}`));
          return;
        }
        resolve(data);
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

/**
 * Calculate code changes from file data
 */
function calculateCodeChanges(filesData: FileChange[]): {
  additions: number;
  deletions: number;
} {
  let totalAdditions = 0;
  let totalDeletions = 0;

  filesData.forEach((file) => {
    if (!isExcludedFile(file.filename)) {
      totalAdditions += file.additions;
      totalDeletions += file.deletions;
    }
  });

  return { additions: totalAdditions, deletions: totalDeletions };
}

/**
 * Helper function to extract repo info from URL
 */
function extractRepoInfo(url: string): { owner: string; repo: string } {
  const urlParts = url.split("/");
  return {
    repo: urlParts[4]!,
    owner: urlParts[3]!,
  };
}

/**
 * Check if PR should be skipped based on branch info
 */
function shouldSkipPR(head?: string, base?: string): boolean {
  return !!(
    (head === "develop" && base === "master") ||
    (head === "master" && base === "develop") ||
    (head === "main" && base === "develop") ||
    (head === "develop" && base === "main") ||
    (head === "main" && base === "deploy-to-main") ||
    (head === "deploy-to-main" && base === "main") ||
    (head === "merge-develop-to-master" && base === "master")
  );
}

/**
 * Check if file should be excluded from stats
 */
function isExcludedFile(filename: string): boolean {
  return CONFIG.EXCLUDED_FILES.some((pattern) => {
    if (pattern.startsWith(".") && filename.endsWith(pattern)) {
      return true;
    } else if (pattern.endsWith("/") && filename.includes(pattern)) {
      return true;
    } else if (filename.includes(pattern)) {
      return true;
    }
    return false;
  });
}

/**
 * Get GitHub API headers
 */
function getGitHubHeaders(): Record<string, string> {
  return {
    "User-Agent": "node.js",
    Authorization: `Bearer ${CONFIG.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
  };
}

/**
 * Debug function to verify query construction and date format
 */
function debugQuery(author: string): void {
  const query = `org:${CONFIG.ORGANIZATION} is:pr author:${author} created:${CONFIG.START_DATE}..${CONFIG.END_DATE}`;
  console.log(`🔍 Debug Query for ${author}:`);
  console.log(`   Organization: ${CONFIG.ORGANIZATION}`);
  console.log(`   Start Date: ${CONFIG.START_DATE}`);
  console.log(`   End Date: ${CONFIG.END_DATE}`);
  console.log(`   Full Query: ${query}`);
  console.log(`   Encoded Query: ${encodeURIComponent(query)}`);
  console.log(`   Date Range: ${CONFIG.START_DATE}..${CONFIG.END_DATE}`);
}
