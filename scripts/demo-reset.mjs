#!/usr/bin/env node
/**
 * demo-reset.mjs · C5.4 Demo-Reset-Skript
 *
 * Setzt den Server-Zustand zwischen Demos sauber zurück. Drei Modi:
 *
 *   --fresh              Server stoppen → server-storage/ leeren → Server neu
 *                        starten → Health-Check. Demo startet mit leerem
 *                        System-State ("Generischer Tenant wird live
 *                        angelegt"-Narrativ).
 *
 *   --demo-ready         Server stoppen → server-storage/ auf den
 *                        vorbereiteten Baseline-Stand zurücksetzen →
 *                        Server neu starten → Health-Check. Demo startet
 *                        mit bereits angelegtem Tenant, ohne aktivierte
 *                        Packs (Tenant-Anlage-Moment wird übersprungen).
 *
 *   --capture-baseline   Aktuellen server-storage/-Stand als
 *                        demo-ready-baseline/ einfrieren. Einmalige
 *                        Vorbereitung; der Baseline-Ordner kann in den
 *                        Git-Stand committed werden (oder via .gitignore
 *                        lokal bleiben, je nach Operator-Präferenz).
 *
 * Cross-platform: Läuft auf Windows (Git Bash / PowerShell) und
 * Unix-artigen Systemen. Nutzt nur Node-Built-Ins.
 *
 * Aufruf:
 *   node scripts/demo-reset.mjs --fresh
 *   node scripts/demo-reset.mjs --demo-ready
 *   node scripts/demo-reset.mjs --capture-baseline
 *
 * Alternativ via npm:
 *   npm run demo:reset:fresh
 *   npm run demo:reset:ready
 *   npm run demo:capture-baseline
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const STORAGE_DIR = resolve(REPO_ROOT, 'server-storage');
const BASELINE_DIR = resolve(REPO_ROOT, 'demo-ready-baseline');
const API_PORT = Number(process.env.KRISENFEST_API_PORT || 8787);
const HEALTH_URL = `http://localhost:${API_PORT}/api/health/live`;
const STARTUP_GRACE_MS = 2_000;
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 500;

function log(message) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[demo-reset ${ts}] ${message}`);
}

function warn(message) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.warn(`[demo-reset ${ts}] WARN  ${message}`);
}

function fail(message) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.error(`[demo-reset ${ts}] ERROR ${message}`);
  process.exit(1);
}

// ============================================================================
// Server-Stop · plattform-spezifisch via netstat + taskkill/kill
// ============================================================================

function execCapture(cmd, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { shell: true });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.on('error', () => resolvePromise(''));
    child.on('exit', () => resolvePromise(stdout));
  });
}

async function findPidsOnPort(port) {
  const pids = new Set();
  if (process.platform === 'win32') {
    // Windows: netstat -ano | findstr :PORT
    const stdout = await execCapture('netstat', ['-ano']);
    for (const line of stdout.split(/\r?\n/)) {
      if (line.includes(`:${port}`) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
    }
  } else {
    // Unix: lsof -t -i:PORT
    const stdout = await execCapture('lsof', ['-t', `-i:${port}`]);
    for (const pid of stdout.split(/\s+/).filter(Boolean)) {
      pids.add(pid);
    }
  }
  return [...pids];
}

async function killPid(pid) {
  return new Promise((resolvePromise) => {
    const cmd = process.platform === 'win32' ? 'taskkill' : 'kill';
    const args = process.platform === 'win32' ? ['/F', '/PID', pid] : ['-9', pid];
    const child = spawn(cmd, args, { shell: true, stdio: 'ignore' });
    child.on('error', () => resolvePromise(false));
    child.on('exit', (code) => resolvePromise(code === 0));
  });
}

async function stopServer() {
  log('Suche nach laufenden Server-Prozessen auf Port ' + API_PORT + '…');
  const pids = await findPidsOnPort(API_PORT);
  if (!pids.length) {
    log('Keine laufenden Server-Prozesse gefunden. Weiter.');
    return;
  }
  for (const pid of pids) {
    log(`Stoppe Prozess PID ${pid}…`);
    const ok = await killPid(pid);
    if (!ok) {
      warn(`Konnte Prozess ${pid} nicht zuverlässig beenden. Manuell prüfen.`);
    }
  }
  // Kurze Gnadenfrist, damit SQLite-Locks sich lösen.
  await new Promise((r) => setTimeout(r, 500));
}

// ============================================================================
// Storage-Reset · Ordner-Operationen
// ============================================================================

async function resetFresh() {
  log('Lösche server-storage/ (fresh Modus)…');
  // Einzeln löschen statt den Top-Ordner, damit .gitkeep / Marker-Dateien
  // überleben, falls vorhanden.
  const subdirs = ['system', 'tenants', 'tmp', 'uploads'];
  for (const sub of subdirs) {
    const path = resolve(STORAGE_DIR, sub);
    if (existsSync(path)) {
      await rm(path, { recursive: true, force: true });
      log(`  ✓ ${sub}/ entfernt`);
    }
  }
  // Frische Verzeichnisse, die der Server erwartet.
  for (const sub of subdirs) {
    await mkdir(resolve(STORAGE_DIR, sub), { recursive: true });
  }
  log('server-storage/ frisch initialisiert.');
}

async function resetDemoReady() {
  if (!existsSync(BASELINE_DIR)) {
    fail(
      'demo-ready-baseline/ nicht gefunden. Zuerst einmalig ausführen:\n'
      + '  1. Server starten, manuell den gewünschten Demo-Startzustand herstellen\n'
      + '     (z. B. Tenant "Klinikverbund Donau-Ries" anlegen, Admin konfigurieren)\n'
      + '  2. Server stoppen\n'
      + '  3. node scripts/demo-reset.mjs --capture-baseline\n'
      + 'Danach steht --demo-ready zur Verfügung.',
    );
  }
  log('Stelle server-storage/ aus demo-ready-baseline/ wieder her…');
  await resetFresh();
  // cp -r baseline → storage, via node:fs/promises.cp rekursiv
  await cp(BASELINE_DIR, STORAGE_DIR, { recursive: true });
  log('server-storage/ auf demo-ready-baseline/ zurückgesetzt.');
}

async function captureBaseline() {
  if (!existsSync(STORAGE_DIR)) {
    fail('server-storage/ existiert nicht. Zuerst Server mindestens einmal starten.');
  }
  if (existsSync(BASELINE_DIR)) {
    log('Alter demo-ready-baseline/-Ordner wird überschrieben…');
    await rm(BASELINE_DIR, { recursive: true, force: true });
  }
  log('Kopiere server-storage/ → demo-ready-baseline/…');
  await cp(STORAGE_DIR, BASELINE_DIR, { recursive: true });
  log('Baseline gesichert. Ab jetzt steht --demo-ready zur Verfügung.');
  log('Hinweis: Der Ordner demo-ready-baseline/ kann per git committed werden,');
  log('falls er über Git verteilt werden soll, oder via .gitignore lokal bleiben.');
}

// ============================================================================
// Server-Start + Health-Check
// ============================================================================

function startServer() {
  log('Starte Server im Hintergrund (npm run dev)…');
  // Detached Spawn: Server bleibt laufen, auch wenn das Reset-Script endet.
  const isWin = process.platform === 'win32';
  const child = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    shell: isWin,
  });
  child.unref();
  log(`Server-Startprozess gestartet (PID ${child.pid}).`);
}

async function healthCheck() {
  log('Warte auf Server-Startup (Grace ' + STARTUP_GRACE_MS + 'ms)…');
  await new Promise((r) => setTimeout(r, STARTUP_GRACE_MS));
  log('Poll Health-Endpoint ' + HEALTH_URL + ' …');
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) {
        log(`Server healthy: HTTP ${response.status}.`);
        return;
      }
    } catch {
      // Noch nicht bereit, weiter pollen.
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  fail(`Health-Check nach ${HEALTH_TIMEOUT_MS}ms nicht erfolgreich. Server startete vermutlich nicht.`);
}

// ============================================================================
// Main-Dispatch
// ============================================================================

function printUsage() {
  console.log(`Usage:
  node scripts/demo-reset.mjs --fresh              Komplett-Reset, frischer Tenant-Bootstrap
  node scripts/demo-reset.mjs --demo-ready         Reset auf demo-ready-baseline/ (Tenant vorbereitet)
  node scripts/demo-reset.mjs --capture-baseline   Aktuellen Storage als Baseline einfrieren
  node scripts/demo-reset.mjs --help               Diese Hilfe anzeigen

Env-Variablen:
  KRISENFEST_API_PORT   Port des API-Servers (Default 8787)
`);
}

async function main() {
  const mode = process.argv[2] ?? '--help';
  switch (mode) {
    case '--fresh':
      await stopServer();
      await resetFresh();
      startServer();
      await healthCheck();
      log('Fertig. Demo-Start bereit (Fresh-Bootstrap).');
      break;
    case '--demo-ready':
      await stopServer();
      await resetDemoReady();
      startServer();
      await healthCheck();
      log('Fertig. Demo-Start bereit (demo-ready-baseline).');
      break;
    case '--capture-baseline':
      await stopServer();
      await captureBaseline();
      log('Fertig. Baseline eingefroren.');
      break;
    case '--help':
    case '-h':
      printUsage();
      break;
    default:
      console.error(`Unbekannter Modus: ${mode}\n`);
      printUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  fail(`Unerwarteter Fehler: ${error?.message || error}`);
});
