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
  const promises = CONFIG.AUTHORS.map((author) => fetchAuthorPRs(author));
  const authorPRArrays = await Promise.all(promises);

  const flatPRs = authorPRArrays.flat();
  console.log(`📝 Found ${flatPRs.length} pull requests`);

  // Combine all PRs into one array
  return flatPRs;
}

/**
 * Fetches PRs for a specific author
 */
async function fetchAuthorPRs(author: string): Promise<PullRequestInfo[]> {
  console.log(`🔍 Fetching ${author}'s pull requests`);

  const encodedQuery = encodeURIComponent(
    `org:${CONFIG.ORGANIZATION} is:pr author:${author} created:${CONFIG.START_DATE}..${CONFIG.END_DATE}`
  );

  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path: `/search/issues?q=${encodedQuery}&per_page=100`,
    method: "GET",
    headers: getGitHubHeaders(),
  };

  try {
    const data = await makeHttpRequest(options);
    const result = JSON.parse(data);

    if (result.items && Array.isArray(result.items)) {
      return result.items.map((pr: any) => ({
        number: pr.number,
        created_at: formatDate(pr.created_at),
        closed_at: formatDate(pr.closed_at),
        title: pr.title,
        user: { login: pr.user.login },
        html_url: pr.html_url,
      }));
    } else {
      console.error(`❌ Invalid response for author ${author}:`, result);
      return [];
    }
  } catch (error) {
    console.error(`❌ Error fetching PRs for author ${author}:`, error);
    return [];
  }
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

  // Create a deep copy of the PRs to avoid modifying the original
  const detailedPRs = JSON.parse(JSON.stringify(prs)) as PullRequestInfo[];

  // Process each PR in parallel
  const prDetailsPromises = detailedPRs.map((pr) => enrichPRWithDetails(pr));
  const processedPRs = await Promise.all(prDetailsPromises);

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
async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<FileChange[]> {
  const options: https.RequestOptions = {
    hostname: "api.github.com",
    path: `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    method: "GET",
    headers: getGitHubHeaders(),
  };

  try {
    const data = await makeHttpRequest(options);
    const filesData = JSON.parse(data);

    if (Array.isArray(filesData)) {
      return filesData;
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
 * Helper function to make HTTP requests that returns a Promise
 */
function makeHttpRequest(options: https.RequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        // Check for HTTP error status codes
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`HTTP Error: ${res.statusCode} - ${data}`));
          return;
        }
        resolve(data);
      });
    });

    req.on("error", (error) => {
      reject(error);
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
    (head === "deploy-to-main" && base === "main")
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
