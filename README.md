# jira-tool

A CLI for quickly creating Jira tickets from the terminal.

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

## Usage

```bash
# Interactive — prompts for title, description, and project
jira

# Pass the title directly
jira "Fix login bug"

# Pass title and description
jira "Fix login bug" -d "Users are unable to log in with SSO"
```

On success the new ticket key (e.g. `ENG-123`) is printed and copied to your clipboard. macOS only for clipboard support.

## Commands

| Flag        | Description                |
| ----------- | -------------------------- |
| `--setup`   | Re-run credential setup    |
| `--project` | Change the default project |

## Uninstalling

```bash
npm unlink -g jira-tool
```
