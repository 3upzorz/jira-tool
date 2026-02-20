import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { loadConfig, saveConfig, type Config, type Project } from './config.ts';
import { fetchProjects, createIssue, fetchIssue, type IssueDetail } from './api.ts';

// ─── Setup ───────────────────────────────────────────────────────────────────

async function runSetup(existing: Partial<Config> = {}): Promise<Config> {
  console.log(chalk.bold('\nJira Tool Setup\n'));

  const jiraUrl = await input({
    message: 'Jira URL (e.g. https://company.atlassian.net):',
    default: existing.jiraUrl,
    validate: v => v.trim().startsWith('http') || 'Must be a valid URL',
  });

  const email = await input({
    message: 'Jira email:',
    default: existing.email,
    validate: v => v.includes('@') || 'Must be a valid email',
  });

  const apiToken = await input({
    message: 'API token (create at https://id.atlassian.com/manage-profile/security/api-tokens):',
    default: existing.apiToken,
    validate: v => v.trim().length > 0 || 'Required',
  });

  const config: Config = {
    jiraUrl: jiraUrl.trim().replace(/\/$/, ''),
    email: email.trim(),
    apiToken: apiToken.trim(),
    defaultProject: existing.defaultProject,
  };

  saveConfig(config);
  console.log(chalk.green('\n✓ Credentials saved.\n'));
  return config;
}

// ─── Project picker ───────────────────────────────────────────────────────────

async function pickProject(config: Config): Promise<Project> {
  process.stdout.write(chalk.dim('Fetching projects…'));
  const projects = await fetchProjects(config);
  process.stdout.write('\r\x1b[K'); // clear the line

  const project = await select<Project>({
    message: 'Select a project:',
    choices: projects
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(p => ({ value: p, name: `${chalk.bold(p.key)} — ${p.name}` })),
  });

  const remember = await confirm({ message: 'Remember as default project?', default: true });
  if (remember) {
    saveConfig({ defaultProject: project });
  }

  return project;
}

// ─── Display issue ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, (s: string) => string> = {
  'To Do':       chalk.gray,
  'New':         chalk.gray,
  'In Progress': chalk.blue,
  'In Review':   chalk.cyan,
  'Done':        chalk.green,
};

function statusColor(statusCategory: string, statusName: string): (s: string) => string {
  if (STATUS_COLORS[statusName]) return STATUS_COLORS[statusName];
  if (statusCategory === 'Done') return chalk.green;
  if (statusCategory === 'In Progress') return chalk.blue;
  return chalk.gray;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function section(label: string): string {
  const line = '─'.repeat(Math.max(0, 60 - label.length - 2));
  return chalk.dim(`── ${label} ${line}`);
}

function displayIssue(issue: IssueDetail, jiraUrl: string): void {
  const colorFn = statusColor(issue.statusCategory, issue.status);
  const badge = colorFn(` ${issue.status} `);

  console.log();
  console.log(`${chalk.bold(issue.key)}  ${badge}`);
  console.log(chalk.white.bold(issue.summary));
  console.log(chalk.dim(`${jiraUrl}/browse/${issue.key}`));

  // Description
  console.log('\n' + section('Description'));
  if (issue.description.trim()) {
    console.log(issue.description);
  } else {
    console.log(chalk.dim('  No description.'));
  }

  // Subtasks
  if (issue.subtasks.length > 0) {
    console.log('\n' + section(`Subtasks (${issue.subtasks.length})`));
    for (const st of issue.subtasks) {
      const done = st.status === 'Done';
      const marker = done ? chalk.green('✓') : chalk.dim('○');
      const text = done ? chalk.strikethrough.dim(st.summary) : st.summary;
      console.log(`  ${marker} ${chalk.bold(st.key)}  ${text}`);
    }
  }

  // Comments
  if (issue.comments.length > 0) {
    console.log('\n' + section(`Comments (${issue.comments.length})`));
    for (const c of issue.comments) {
      console.log(`\n  ${chalk.bold(c.author)} ${chalk.dim('·')} ${chalk.dim(formatDate(c.created))}`);
      const indented = c.body
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n');
      console.log(indented);
    }
  }

  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isSetup = args.includes('--setup');
  const isChangeProject = args.includes('--project');
  const readFlagIdx = Math.max(args.indexOf('--read'), args.indexOf('-r'));

  let config = loadConfig();

  // First-run or explicit --setup
  if (isSetup || !config.jiraUrl || !config.email || !config.apiToken) {
    config = await runSetup(config);
  }

  const fullConfig = config as Config;

  // Change default project
  if (isChangeProject) {
    await pickProject(fullConfig);
    console.log(chalk.green('✓ Default project updated.'));
    return;
  }

  // ── Read ticket ─────────────────────────────────────────────────────────
  if (readFlagIdx !== -1) {
    const issueKey = args[readFlagIdx + 1];
    if (!issueKey || issueKey.startsWith('-')) {
      console.error(chalk.red('Usage: jira --read <ISSUE-KEY>'));
      process.exit(1);
    }

    process.stdout.write(chalk.dim('Fetching issue…'));
    try {
      const issue = await fetchIssue(fullConfig, issueKey.toUpperCase());
      process.stdout.write('\r\x1b[K');
      displayIssue(issue, fullConfig.jiraUrl);
    } catch (err: unknown) {
      process.stdout.write('\r\x1b[K');
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red('\nFailed to read ticket:'), message);
      process.exit(1);
    }
    return;
  }

  // ── Title ────────────────────────────────────────────────────────────────
  const titleArg = args.find(a => !a.startsWith('-'));
  const summary = titleArg ?? await input({
    message: 'Ticket title:',
    validate: v => v.trim().length > 0 || 'Title is required',
  });

  if (!summary.trim()) {
    console.error(chalk.red('Title is required.'));
    process.exit(1);
  }

  // ── Description ──────────────────────────────────────────────────────────
  const descFlagIdx = args.indexOf('-d');
  const descArg = descFlagIdx !== -1 ? args[descFlagIdx + 1] : undefined;
  const description = descArg ?? await input({ message: 'Description (optional, enter to skip):' });

  // ── Project ──────────────────────────────────────────────────────────────
  let project = fullConfig.defaultProject;
  if (!project) {
    project = await pickProject(fullConfig);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  process.stdout.write(chalk.dim('\nCreating ticket…'));

  try {
    const issue = await createIssue(
      fullConfig,
      project.key,
      summary.trim(),
      description.trim() || undefined,
    );

    process.stdout.write('\r\x1b[K');

    console.log('\n' + chalk.green.bold(issue.key));
    console.log(chalk.dim(`${fullConfig.jiraUrl}/browse/${issue.key}\n`));

    // Copy key to clipboard (macOS)
    try {
      execSync(`echo -n "${issue.key}" | pbcopy`);
      console.log(chalk.dim('Copied to clipboard.'));
    } catch {
      // Not on macOS or pbcopy unavailable — no-op
    }
  } catch (err: unknown) {
    process.stdout.write('\r\x1b[K');
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red('\nFailed to create ticket:'), message);
    process.exit(1);
  }
}

main().catch(err => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red('Error:'), message);
  process.exit(1);
});
