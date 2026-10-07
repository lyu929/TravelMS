const { spawn } = require('node:child_process');
const path = require('node:path');
require('../db');
const root = path.join(__dirname, '..');
const environment = { ...process.env, NG_CLI_ANALYTICS: 'false' };
const server = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: environment,
  stdio: 'inherit',
});
const frontend = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
    'serve',
    '--host',
    '127.0.0.1',
    '--proxy-config',
    'proxy.conf.cjs',
  ],
  { cwd: root, env: environment, stdio: 'inherit' },
);
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  server.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exitCode = code;
  setTimeout(() => {
    server.kill('SIGKILL');
    frontend.kill('SIGKILL');
  }, 5000).unref();
}
for (const child of [server, frontend]) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!closing) stop(code || 0);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
