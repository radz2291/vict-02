import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export async function launchPreview() {
  if (process.env.VICT_PREVIEW_URL) {
    const browser = await launchBrowser();
    return { base: process.env.VICT_PREVIEW_URL, browser, close: () => browser.close() };
  }
  const server = spawn(process.execPath, ['build'], {
    cwd: join(root, 'examples/ui-showcase'),
    env: { ...process.env, VICT_COMPOSITION: '1', PORT: '0', HOST: '127.0.0.1' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  server.stderr.on('data', (data) => {
    errors += data;
  });
  let browser;
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Preview timeout: ' + errors)), 30000);
      server.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error('Preview exited ' + code + errors));
      });
      server.stdout.on('data', (data) => {
        const match = /http:\/\/[^\s:]+:(\d+)/.exec(String(data));
        if (match) {
          clearTimeout(timer);
          resolve('http://127.0.0.1:' + match[1]);
        }
      });
    });
    browser = await launchBrowser();
    return {
      base,
      browser,
      close: async () => {
        await browser.close();
        server.kill();
      },
    };
  } catch (error) {
    await browser?.close();
    server.kill();
    throw error;
  }
}
async function launchBrowser() {
  const executablePath = [
    process.env.VICT_BROWSER_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].find((path) => path && existsSync(path));
  if (!executablePath) throw Error('Set VICT_BROWSER_PATH to a Chromium executable.');
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
}
