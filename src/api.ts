import type { Config, Project } from "./config.ts";

export interface CreatedIssue {
  id: string;
  key: string;
}

export interface IssueDetail {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  description: string;
  subtasks: Array<{
    key: string;
    summary: string;
    status: string;
  }>;
  comments: Array<{
    author: string;
    body: string;
    created: string;
  }>;
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

// ---------------------------------------------------------------------------
// ADF (Atlassian Document Format) → plain text
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adfToText(node: any, listDepth = 0): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return `@${node.attrs?.text ?? "unknown"}`;
  if (node.type === "emoji") return node.attrs?.shortName ?? "";
  if (node.type === "inlineCard") return node.attrs?.url ?? "";

  const children: string[] = (node.content ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (child: any, i: number) => {
      if (node.type === "orderedList") {
        const prefix = `${" ".repeat(listDepth * 2)}${i + 1}. `;
        return prefix + adfToText(child, listDepth + 1).trimStart();
      }
      if (node.type === "bulletList") {
        const prefix = `${" ".repeat(listDepth * 2)}• `;
        return prefix + adfToText(child, listDepth + 1).trimStart();
      }
      return adfToText(child, listDepth);
    },
  );

  switch (node.type) {
    case "doc":
      return children.join("").trimEnd();
    case "paragraph":
      return children.join("") + "\n";
    case "heading":
      return children.join("") + "\n";
    case "listItem":
      return children.join("");
    case "codeBlock":
      return children.join("") + "\n";
    case "blockquote":
      return children
        .join("")
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n") + "\n";
    case "rule":
      return "---\n";
    case "mediaSingle":
    case "media":
      return "[media]\n";
    default:
      return children.join("");
  }
}

// ---------------------------------------------------------------------------
// Fetch a single issue
// ---------------------------------------------------------------------------

export async function fetchIssue(
  config: Config,
  issueKey: string,
): Promise<IssueDetail> {
  const url = `${config.jiraUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,description,subtasks,comment`;

  const res = await fetch(url, { headers: headers(config) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch issue ${issueKey} (${res.status}): ${body}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const fields = data.fields;

  const subtasks: IssueDetail["subtasks"] = (fields.subtasks ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (st: any) => ({
      key: st.key as string,
      summary: st.fields?.summary as string,
      status: st.fields?.status?.name as string,
    }),
  );

  const comments: IssueDetail["comments"] = (
    fields.comment?.comments ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).map((c: any) => ({
    author: (c.author?.displayName ?? "Unknown") as string,
    body: adfToText(c.body),
    created: c.created as string,
  }));

  return {
    key: data.key,
    summary: fields.summary,
    status: fields.status?.name ?? "Unknown",
    statusCategory: fields.status?.statusCategory?.name ?? "Unknown",
    description: adfToText(fields.description),
    subtasks,
    comments,
  };
}
