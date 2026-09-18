import {access} from 'node:fs/promises';
import {chromium} from 'playwright-core';

/**
 * Launch the Playwright Chromium revision for this project. A caller may point
 * at an already-installed compatible executable without changing test files.
 */
export async function launchChromium(options={}) {
 const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||chromium.executablePath();
 try {
  await access(executablePath);
 } catch {
  throw new Error(`Chromium was not found at ${executablePath}. Install the project's Playwright Chromium revision (for example: node node_modules/playwright-core/cli.js install chromium), or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.`);
 }
 return chromium.launch({executablePath,...options});
}
