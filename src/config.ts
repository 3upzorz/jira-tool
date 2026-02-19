import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

export interface Project {
  key: string;
  name: string;
  id: string;
}

export interface Config {
  jiraUrl: string;
  email: string;
  apiToken: string;
  defaultProject?: Project;
}

const CONFIG_DIR = join(homedir(), '.config', 'jira-tool');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function loadConfig(): Partial<Config> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Partial<Config>;
  } catch {
    return {};
  }
}

export function saveConfig(updates: Partial<Config>): void {
  const existing = loadConfig();
  const merged = { ...existing, ...updates };
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}
