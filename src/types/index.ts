export interface PullRequestInfo {
  project: string;
  number: number;
  title: string;
  description: string | null;
  user: { login: string };
  html_url: string;
  additions?: number;
  deletions?: number;
  closed_at: string;
  base?: string;
  head?: string;
}

export interface FileChange {
  filename: string;
  additions: number;
  deletions: number;
}

export interface AuthorStats {
  author: string;
  prCount: number;
  authorAdditions: number;
  authorDeletions: number;
  authorChanges: number;
}

export interface RepoStats {
  repo: string;
  changes: number;
}
