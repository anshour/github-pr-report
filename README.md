# GitHub PR Report Generator

A cli app built with Bun that generates comprehensive Excel reports for GitHub Pull Requests within a specified organization and date range.

## Features

- 📊 **Excel Report Generation**: Creates detailed Excel files with PR data and statistics
- 👥 **Multi-Author Support**: Tracks PRs from multiple team members
- 📈 **Comprehensive Analytics**: Includes author statistics, top PRs, and repository insights
- 🔍 **Smart Filtering**: Automatically excludes certain file types and PR patterns
- 📅 **Date Range Support**: Filter PRs by creation date
- 🇮🇩 **Localized Output**: Indonesian language support for reports

## Prerequisites

- [Bun](https://bun.sh) v1.2.9 or higher
- GitHub Personal Access Token with repository read permissions
- Access to the target GitHub organization

## Installation

1. Clone this repository:

```bash
git clone <repository-url>
cd github-pr-report
```

2. Install dependencies:

```bash
bun install
```

3. Create a `.env` file in the root directory:

```env
GITHUB_TOKEN=your_github_token_here
START_DATE=2025-05-01
END_DATE=2025-05-31
```

## Configuration

### Environment Variables

| Variable              | Description                                                       | Example             |
| --------------------- | ----------------------------------------------------------------- | ------------------- |
| `GITHUB_TOKEN`        | GitHub Personal Access Token                                      | `ghp_xxxxxxxxxxxx`  |
| `START_DATE`          | Report start date (YYYY-MM-DD)                                    | `2025-05-01`        |
| `END_DATE`            | Report end date (YYYY-MM-DD)                                      | `2025-05-31`        |
| `GITHUB_AUTHORS`      | Comma-separated list of GitHub usernames to include in the report | `user1,user2,user3` |
| `GITHUB_ORGANIZATION` | GitHub organization name                                          | `my-org`            |

### Application Configuration

Edit [`src/config.ts`](src/config.ts) to customize:

- **EXCLUDED_FILES**: File patterns to exclude from statistics
- **OUTPUT_DIR**: Directory for generated Excel files

## Usage

Run the application to generate a PR report:

```bash
bun run start
```

The application will:

1. Fetch PRs from GitHub for all configured authors
2. Gather detailed information including code changes
3. Generate an Excel file in the `output/` directory

## Output

The generated Excel file contains two worksheets:

### 1. Pull Requests

Detailed list of all PRs with:

- Project name
- PR title and description
- Author information
- Code additions/deletions
- Merge date
- PR URL

### 2. Summary

Comprehensive statistics including:

- Report period information
- Overall PR statistics
- Per-author breakdown
- Top 5 PRs with most changes
- Top 5 repositories by changes

## Project Structure

```
src/
├── services/
│   ├── excel.ts      # Excel file generation
│   └── github.ts     # GitHub API communication
├── types/
│   └── index.ts      # TypeScript interfaces
├── utils/
│   └── date.ts       # Date formatting utilities
├── config.ts         # Application configuration
└── index.ts          # Main entry point
```

## Key Components

- **GitHub Service** ([`src/services/github.ts`](src/services/github.ts)): Handles GitHub API interactions using [`fetchPullRequests`](src/services/github.ts) and [`fetchPRDetails`](src/services/github.ts)
- **Excel Service** ([`src/services/excel.ts`](src/services/excel.ts)): Generates Excel reports using [`exportToExcel`](src/services/excel.ts)
- **Date Utilities** ([`src/utils/date.ts`](src/utils/date.ts)): Provides date formatting functions like [`formatDate`](src/utils/date.ts) and [`getFileTimestamp`](src/utils/date.ts)
- **Type Definitions** ([`src/types/index.ts`](src/types/index.ts)): Defines interfaces like [`PullRequestInfo`](src/types/index.ts) and [`AuthorStats`](src/types/index.ts)

### Excluded PRs

- PRs that are neither open nor merged
- Branch sync PRs (develop ↔ master, main ↔ deploy-to-main, etc.)

## Output Files

Generated Excel files are saved to the `output/` directory with timestamps:

```
output/github_prs_2025-05-15T10-30-45-123Z.xlsx
```

## Error Handling

The application includes comprehensive error handling for:

- GitHub API rate limits and errors
- Network connectivity issues
- Invalid PR data
- File system operations

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project was created using `bun init` in bun v1.2.9. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
