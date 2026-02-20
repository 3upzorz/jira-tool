# jira-tool

A CLI for creating and reading Jira tickets from the terminal.

## Installation

```bash
git clone <repo-url>
cd jira-tool
npm install
npm link
```

`npm link` registers the `jira` command globally so you can run it from any directory.

## First-time setup

Run `jira` for the first time (or `jira --setup` at any point) and you'll be prompted for:

- **Jira URL** — e.g. `https://yourcompany.atlassian.net`
- **Email** — the email address on your Atlassian account
- **API token** — generate one at https://id.atlassian.com/manage-profile/security/api-tokens:
  1. Click **Create API token**
  2. Give it a label (e.g. `jira-tool`)
  3. Use a regular token, not a scoped token (for ease-of-use, I couldn't be bothered trying to figure out the right scopes)
  4. Set **Expiration** to **1 year** (max)
  5. Click **Create** and copy the token — you won't be able to see it again

Credentials are saved to `~/.config/jira-tool/config.json`.

## Commands

### Create a ticket

```bash
# Interactive — prompts for title, description, and project
jira

# Pass the title directly
jira "Fix login bug"

# Pass title and description
jira "Fix login bug" -d "Users are unable to log in with SSO"
```

**Arguments:**

| Argument          | Required | Description                           |
| ----------------- | -------- | ------------------------------------- |
| `<title>`         | No       | Ticket title. Prompted if omitted.    |
| `-d <description>`| No       | Ticket description. Prompted if omitted (enter to skip). |

**Behavior:**
- If no default project is set, you'll be prompted to pick one.
- On success, prints the new ticket key (e.g. `ENG-123`) and copies it to the clipboard (macOS only).
- Created tickets have issue type "Task".

### Read a ticket

```bash
jira --read <ISSUE-KEY>
jira -r <ISSUE-KEY>
```

**Arguments:**

| Argument       | Required | Description                                    |
| -------------- | -------- | ---------------------------------------------- |
| `<ISSUE-KEY>`  | Yes      | The Jira issue key, e.g. `ENG-123`. Case-insensitive. |

**Output sections (in order):**

1. **Header** — issue key, status (color-coded), summary title, and link to the ticket.
2. **Description** — the ticket description converted from Jira's document format to plain text. Shows "No description." if empty.
3. **Subtasks** — listed only if the ticket has subtasks. Each subtask shows a completion marker (`✓` for Done, `○` otherwise), its key, and summary.
4. **Comments** — listed only if the ticket has comments. Each comment shows the author name, date, and body text.

**Example output:**

```
ENG-123   In Progress
Fix login timeout on mobile
https://yourcompany.atlassian.net/browse/ENG-123

── Description ─────────────────────────────────────────────
Users on iOS are experiencing a 30s timeout when attempting to log in.

── Subtasks (2) ────────────────────────────────────────────
  ✓ ENG-124  Increase timeout threshold
  ○ ENG-125  Add retry logic

── Comments (1) ────────────────────────────────────────────

  Jane Doe · Jan 15, 2026
  Confirmed this is reproducible on iOS 18.2
```

### Other flags

| Flag        | Description                              |
| ----------- | ---------------------------------------- |
| `--setup`   | Re-run credential setup                  |
| `--project` | Change the default project               |

## Configuration

Stored at `~/.config/jira-tool/config.json`. Fields:

| Field            | Type   | Description                          |
| ---------------- | ------ | ------------------------------------ |
| `jiraUrl`        | string | Base Jira URL (no trailing slash)    |
| `email`          | string | Atlassian account email              |
| `apiToken`       | string | Atlassian API token                  |
| `defaultProject` | object | `{ key, name, id }` of the default project (optional) |

## Development

```bash
npm run dev            # Run the CLI via tsx
npm run typecheck      # Type-check with tsc --noEmit
```

## Uninstalling

```bash
npm unlink -g jira-tool
```
