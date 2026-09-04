import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workerDir = path.join(root, 'apps', 'worker');

console.log('Running Address Coverage Census...');
try {
  execFileSync('pnpm', ['exec', 'tsx', 'src/census/run-census.ts'], {
    cwd: workerDir,
    stdio: 'inherit',
    env: process.env,
  });
} catch (error) {
  console.error('Census script failed:', error.message);
  process.exit(1);
}
