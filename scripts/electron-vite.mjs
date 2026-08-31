import { spawnSync } from 'child_process';

delete process.env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
const result = spawnSync('electron-vite', args, {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

process.exit(result.status ?? 1);
