import { Octokit } from "@octokit/rest";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export const OWNER = process.env.GITHUB_OWNER!;
export const REPO = process.env.GITHUB_REPO!;
export const PAGES_DIR = "pages";
