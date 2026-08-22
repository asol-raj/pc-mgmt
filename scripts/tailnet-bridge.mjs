#!/usr/bin/env node
/**
 * Tailnet -> LAN TCP bridge.
 *
 * The register runs on a VM that cannot join the tailnet, but a Windows PC on the
 * same office LAN can. Run this on that PC: it listens on the tailnet address and
 * relays every connection to the VM, so a machine anywhere on the tailnet reaches
 * the VM as if it were a tailnet node itself.
 *
 *     tailnet client  ->  100.x.x.x:7100  ->  [this bridge]  ->  192.168.0.211:7100
 *
 * It binds to the tailnet address only, never 0.0.0.0, so it does not quietly
 * republish the VM to the whole office LAN. Pass --bind to override.
 *
 * Plain TCP in both directions: HTTP, SSH, anything. No dependencies, no state.
 *
 * Usage:
 *   node tailnet-bridge.mjs --map 7100:192.168.0.211:7100
 *   node tailnet-bridge.mjs --map 7100:192.168.0.211:7100 --map 2222:192.168.0.211:22
 *   node tailnet-bridge.mjs --bind 0.0.0.0 --map 7100:192.168.0.211:7100   (LAN too)
 *
 * Windows Firewall still applies. Allow each listening port once:
 *   netsh advfirewall firewall add rule name="tailnet-bridge 7100" ^
 *     dir=in action=allow protocol=TCP localport=7100
 */
import net from 'node:net';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reads bridge.config.json sitting next to this script, so the machine running
 * the bridge can be set up by editing a file rather than by getting a command
 * line right. Anything passed on the command line wins over it.
 */
function loadConfig(configPath) {
  const file = configPath ?? path.join(HERE, 'bridge.config.json');
  if (!fs.existsSync(file)) {
    if (configPath) throw new Error(`No config file at ${file}`);
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }

  const maps = (parsed.maps ?? []).map((m, i) => {
    if (!m || typeof m !== 'object') throw new Error(`maps[${i}] in ${file} is not an object`);
    return { listenPort: Number(m.listen), targetHost: String(m.host), targetPort: Number(m.port) };
  });
  return { bind: parsed.bind ?? null, maps, file };
}

/** Tailscale hands out addresses from the 100.64.0.0/10 carrier-grade NAT range. */
function tailnetAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      const [a, b] = address.address.split('.').map(Number);
      if (a === 100 && b >= 64 && b <= 127) return address.address;
    }
  }
  return null;
}

function parseArgs(argv) {
  const maps = [];
  let bind = null;
  let configPath = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--config') {
      configPath = argv[++i];
    } else if (arg === '--bind') {
      bind = argv[++i];
    } else if (arg === '--map') {
      const value = argv[++i] ?? '';
      const parts = value.split(':');
      if (parts.length !== 3) {
        throw new Error(`--map wants LISTEN_PORT:TARGET_HOST:TARGET_PORT, got "${value}"`);
      }
      const [listenPort, targetHost, targetPort] = parts;
      maps.push({
        listenPort: Number(listenPort),
        targetHost,
        targetPort: Number(targetPort),
      });
    } else {
      throw new Error(`Unknown argument "${arg}"`);
    }
  }

  return { bind, maps, configPath };
}

function validate(maps) {
  if (!maps.length) {
    throw new Error('Nothing to forward. Add a map to bridge.config.json, or pass --map.');
  }
  for (const m of maps) {
    if (!Number.isInteger(m.listenPort) || m.listenPort < 1 || m.listenPort > 65535) {
      throw new Error(`Bad listen port "${m.listenPort}"`);
    }
    if (!Number.isInteger(m.targetPort) || m.targetPort < 1 || m.targetPort > 65535) {
      throw new Error(`Bad target port "${m.targetPort}"`);
    }
    if (!m.targetHost) throw new Error('A map is missing its target host');
  }
}

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...parts) => console.log(`[${stamp()}]`, ...parts);

function bridge({ bind, listenPort, targetHost, targetPort }) {
  const label = `${bind}:${listenPort} -> ${targetHost}:${targetPort}`;
  let live = 0;
  let total = 0;

  const server = net.createServer((client) => {
    const id = ++total;
    const from = `${client.remoteAddress}:${client.remotePort}`;
    live++;

    const upstream = net.connect(targetPort, targetHost);

    // Latency across a tailnet is real; small writes should not wait on the
    // 40ms Nagle timer before going out.
    client.setNoDelay(true);
    upstream.setNoDelay(true);

    let closed = false;
    const close = (why) => {
      if (closed) return;
      closed = true;
      live--;
      client.destroy();
      upstream.destroy();
      log(`#${id} closed (${why}) — ${live} live on ${listenPort}`);
    };

    upstream.on('connect', () => {
      log(`#${id} ${from} connected — ${live} live on ${listenPort}`);
      client.pipe(upstream);
      upstream.pipe(client);
    });

    // A refused or unreachable VM must not take the bridge down with it.
    upstream.on('error', (err) => close(`upstream ${err.code ?? err.message}`));
    client.on('error', (err) => close(`client ${err.code ?? err.message}`));
    upstream.on('close', () => close('upstream closed'));
    client.on('close', () => close('client closed'));
  });

  server.on('error', (err) => {
    console.error(`[${stamp()}] FATAL ${label}: ${err.code ?? err.message}`);
    if (err.code === 'EADDRNOTAVAIL') {
      console.error('  That bind address is not on this machine. Is Tailscale up?');
    }
    if (err.code === 'EADDRINUSE') {
      console.error('  Something already listens on that port here.');
    }
    process.exit(1);
  });

  server.listen(listenPort, bind, () => log(`listening  ${label}`));
  return server;
}

let bind;
let maps;
try {
  const cli = parseArgs(process.argv.slice(2));
  const config = loadConfig(cli.configPath);
  if (config) log(`config     ${config.file}`);

  // Command line beats the file, so a one-off run needs no edit.
  maps = cli.maps.length ? cli.maps : (config?.maps ?? []);
  validate(maps);
  bind = cli.bind ?? config?.bind ?? tailnetAddress();
} catch (err) {
  console.error(err.message);
  console.error('\nUsage: node tailnet-bridge.mjs [--config FILE] [--bind ADDR]');
  console.error('                               [--map LISTEN_PORT:TARGET_HOST:TARGET_PORT ...]');
  process.exit(1);
}

if (!bind) {
  console.error('No tailnet (100.64.0.0/10) address found on this machine.');
  console.error('Start Tailscale, or pass --bind <address> explicitly.');
  process.exit(1);
}
if (bind === '0.0.0.0') {
  log('WARNING: binding 0.0.0.0 — the target is reachable from the whole LAN, not just the tailnet.');
}

const servers = maps.map((m) => bridge({ bind, ...m }));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`${signal} — shutting down`);
    for (const server of servers) server.close();
    process.exit(0);
  });
}
