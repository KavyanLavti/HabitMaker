// Nightly backup to a private GitHub repo. Every run is a commit, so any past day can be recovered
// from the repo history as well as from the dated files.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { buildBackup } from './dataExport';
import { getMeta, setMeta } from './db';
import { todayKey } from './dates';

const TOKEN_KEY = 'github_backup_token';
const API = 'https://api.github.com';
/** Backups run once per day, any time after this local hour. */
export const BACKUP_HOUR = 2;

export async function getBackupToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setBackupToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export interface BackupStatus {
  lastDate: string | null;
  lastAt: string | null;
  lastError: string | null;
}

export async function getBackupStatus(): Promise<BackupStatus> {
  return {
    lastDate: await getMeta('backup_last_date'),
    lastAt: await getMeta('backup_last_at'),
    lastError: (await getMeta('backup_last_error')) || null,
  };
}

/** Reads settings straight from storage so this also works from the headless background task. */
async function readSettings(): Promise<{ blob: any; enabled: boolean; repo: string }> {
  const raw = await AsyncStorage.getItem('settings-store');
  const blob = raw ? JSON.parse(raw) : undefined;
  const s = blob?.state?.settings ?? {};
  return { blob, enabled: !!s.backupEnabled, repo: String(s.backupRepo ?? '').trim() };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function utf8ToBase64(str: string): string {
  const bytes: number[] = [];
  for (const ch of str) {
    let cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += A[(n >> 18) & 63] + A[(n >> 12) & 63];
    out += i + 1 < bytes.length ? A[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? A[n & 63] : '=';
  }
  return out;
}

async function putFile(token: string, repo: string, path: string, content: string, message: string) {
  const url = `${API}/repos/${repo}/contents/${path}`;
  // An existing file needs its sha to be overwritten
  let sha: string | undefined;
  const head = await fetch(url, { headers: headers(token) });
  if (head.ok) sha = (await head.json()).sha;
  else if (head.status !== 404) throw new Error(await describe(head));

  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ message, content: utf8ToBase64(content), sha }),
  });
  if (!res.ok) throw new Error(await describe(res));
}

async function describe(res: Response): Promise<string> {
  if (res.status === 401) return 'GitHub rejected the token (401). Check it hasn’t expired.';
  if (res.status === 403) return 'Token lacks permission (403). It needs Contents: Read and write on the repo.';
  if (res.status === 404) return 'Repo not found (404). Check owner/repo and that the token can access it.';
  let msg = '';
  try { msg = (await res.json()).message ?? ''; } catch {}
  return `GitHub error ${res.status}${msg ? `: ${msg}` : ''}`;
}

/** Pushes a backup now. Throws with a readable message on failure. */
export async function backupNow(): Promise<void> {
  const { blob, repo } = await readSettings();
  const token = await getBackupToken();
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Set the repo as owner/repo in Settings.');
  if (!token) throw new Error('Add a GitHub token in Settings.');

  try {
    const json = JSON.stringify(await buildBackup(blob), null, 2);
    const day = todayKey();
    await putFile(token, repo, 'habitforge/latest.json', json, `Backup ${day}`);
    await putFile(token, repo, `habitforge/daily/${day}.json`, json, `Daily backup ${day}`);
    await setMeta('backup_last_date', day);
    await setMeta('backup_last_at', new Date().toISOString());
    await setMeta('backup_last_error', '');
  } catch (e: any) {
    await setMeta('backup_last_error', e?.message ?? String(e));
    throw e;
  }
}

/** Runs the daily backup if it's past BACKUP_HOUR and today's hasn't happened. Never throws. */
export async function runBackupIfDue(): Promise<'done' | 'skipped' | 'failed'> {
  try {
    const { enabled, repo } = await readSettings();
    if (!enabled || !repo) return 'skipped';
    if (new Date().getHours() < BACKUP_HOUR) return 'skipped';
    if ((await getMeta('backup_last_date')) === todayKey()) return 'skipped';
    await backupNow();
    return 'done';
  } catch {
    return 'failed';
  }
}

/** Downloads habitforge/latest.json from the repo. */
export async function fetchLatestBackup(): Promise<string> {
  const { repo } = await readSettings();
  const token = await getBackupToken();
  if (!repo || !token) throw new Error('Set up GitHub backup first.');
  const res = await fetch(`${API}/repos/${repo}/contents/habitforge/latest.json`, {
    headers: { ...headers(token), Accept: 'application/vnd.github.raw+json' },
  });
  if (!res.ok) throw new Error(await describe(res));
  return res.text();
}
