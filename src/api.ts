import type { Config, Project } from "./config.ts";

export interface CreatedIssue {
  id: string;
  key: string;
}

function authHeader(config: Config): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

function headers(config: Config): Record<string, string> {
  return {
    Authorization: authHeader(config),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export async function fetchProjects(config: Config): Promise<Project[]> {
  const res = await fetch(`${config.jiraUrl}/rest/api/3/project`, {
    headers: headers(config),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch projects (${res.status}): ${body}`);
  }
  const data = (await res.json()) as Array<{
    id: string;
    key: string;
    name: string;
  }>;
  if (data.length === 0) {
    throw new Error(
      "No projects found. Make sure you api key has access to read projects and that you have at least one project set up.",
    );
  }
  return data.map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

export async function createIssue(
  config: Config,
  projectKey: string,
  summary: string,
  description?: string,
): Promise<CreatedIssue> {
  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    issuetype: { name: "Task" },
  };

  if (description) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: description }],
        },
      ],
    };
  }

  const res = await fetch(`${config.jiraUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create issue (${res.status}): ${body}`);
  }

  return res.json() as Promise<CreatedIssue>;
}
