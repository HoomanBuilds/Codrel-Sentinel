import { upsertVectorsBatch } from "../vector/chroma";

export function log(tag: string, msg: string) {
  const time = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  console.log(`${time} [${tag}] ${msg}`);
}

export async function processIssues(repo: string, issues: any[]) {
  log("processor", `processing issues | repo=${repo} count=${issues.length}`);

  const batch = issues.map((issue) => ({
    id: `${repo}-${issue.number}`,
    text: `Title: ${issue.title}\nBody: ${issue.body}`,
    metadata: {
      repo,
      type: "issue",
      issue_number: issue.number,
      url: issue.html_url,
      state: issue.state,
      created_at: issue.created_at || new Date().toISOString()
    },
  }));

  await upsertVectorsBatch(repo, batch);

  log("processor", `completed | repo=${repo}`);
}