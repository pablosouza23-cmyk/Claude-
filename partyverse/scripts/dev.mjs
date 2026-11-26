// Sobe servidor (tsx watch) e cliente (vite) juntos para desenvolvimento.
import { spawn } from 'node:child_process';
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
const procs = [run('npx', ['tsx', 'watch', 'server/src/main.ts']), run('npx', ['vite', '--config', 'client/vite.config.ts'])];
const stop = () => { for (const p of procs) p.kill(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
