// Local fixture stack for the Stage 9 G2 repair-cycle live journeys.
// Start:   node scripts/stage9-g2-stack.mjs up
// Stop:    kills only the child processes this script started (matched by
//          exact port ownership), nothing else on the machine.
import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';

const root = 'C:/Users/RZ1/Desktop/RZ/vict-02-g2/apps/studio';
const ports = [4310, 5173];

const env = {
  ...process.env,
  VICT_STUDIO_TARGETS: JSON.stringify([
    {
      id: 'local',
      label: 'Local VICT target',
      endpoint: 'http://127.0.0.1:4310',
      credentialRef: 'studio-operator',
    },
    {
      id: 'g2-mutator',
      label: 'Local VICT target (receipt-gated mutator)',
      endpoint: 'http://127.0.0.1:4310',
      credentialRef: 'studio-mutator',
    },
  ]),
  VICT_STUDIO_CREDENTIALS: JSON.stringify({
    'studio-operator': {
      token: 'vict-studio-demo-operator',
      actorLabel: 'studio-operator',
      scopes: ['run.read', 'activation.read', 'audit.read', 'agent.stream.read'],
    },
    'studio-detail': {
      token: 'vict-studio-demo-detail',
      actorLabel: 'operator-detail',
      scopes: ['run.read', 'activation.read', 'audit.read', 'agent.stream.read', 'run.detail'],
    },
    'studio-mutator': {
      token: 'vict-studio-demo-mutator',
      actorLabel: 'studio-mutator',
      scopes: [
        'run.read',
        'activation.read',
        'audit.read',
        'agent.stream.read',
        'run.detail',
        'changeset.read',
        'run.cancel',
        'run.resolve',
        'run.signal',
      ],
    },
    'studio-changeset-author': {
      token: 'vict-studio-demo-author',
      actorLabel: 'changeset-author',
      scopes: [
        'run.read',
        'activation.read',
        'audit.read',
        'agent.stream.read',
        'changeset.read',
        'changeset.propose',
        'changeset.revise',
      ],
    },
    'studio-changeset-approver-a': {
      token: 'vict-studio-demo-approver-a',
      actorLabel: 'changeset-approver-a',
      scopes: [
        'run.read',
        'activation.read',
        'audit.read',
        'changeset.read',
        'changeset.approve',
        'changeset.commit',
      ],
    },
    'studio-changeset-approver-b': {
      token: 'vict-studio-demo-approver-b',
      actorLabel: 'changeset-approver-b',
      scopes: ['run.read', 'activation.read', 'audit.read', 'changeset.read', 'changeset.approve'],
    },
  }),
};
delete env.NODE_ENV;

function portUsed(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(true));
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(port, '127.0.0.1');
  });
}

function pidForPort(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
      { encoding: 'utf8' },
    ).trim();
    return out.length > 0 ? Number(out) : null;
  } catch {
    return null;
  }
}

function pidMatchesScript(pid, needle) {
  if (pid === null) return false;
  try {
    const cmdline = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").CommandLine"`,
      { encoding: 'utf8' },
    );
    return cmdline.includes(needle);
  } catch {
    return false;
  }
}

if (process.argv[2] === 'up') {
  for (const [i, port] of ports.entries()) {
    if (await portUsed(port)) {
      console.log(`port ${port} already in use (pid ${pidForPort(port)}); leaving running`);
      continue;
    }
    const cmd =
      i === 0
        ? ['node', ['scripts/demo-target.mjs']]
        : ['npx.cmd', ['vite', 'dev', '--port', String(port), '--host', '127.0.0.1']];
    const child = spawn(cmd[0], cmd[1], {
      cwd: root,
      env,
      stdio: 'inherit',
      // Windows: .cmd shims require a shell (Node >=22 enforces this).
      shell: i === 0 ? false : true,
      windowsHide: true,
    });
    console.log(`started ${cmd[0]} ${cmd[1].join(' ')} (pid ${child.pid}) on ${port}`);
  }
  await new Promise(() => {});
}
if (process.argv[2] === 'down') {
  for (const port of ports) {
    const pid = pidForPort(port);
    if (pid === null) {
      console.log(`port ${port}: free`);
      continue;
    }
    const owner = pidMatchesScript(pid, 'vict-02-g2');
    console.log(
      `port ${port}: pid ${pid}, ${owner ? 'MATCHES this worktree -> stopping by exact pid' : 'NOT this worktree (left untouched)'}`,
    );
    if (owner) {
      try {
        execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`);
      } catch {}
    }
  }
}
