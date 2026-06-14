const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(msg, color = "reset") {
  const prefix = color ? COLORS[color] || "" : "";
  const suffix = color ? COLORS.reset : "";
  console.log(`${prefix}${msg}${suffix}`);
}

function step(msg) {
  log(`\n${COLORS.bold}▶ ${msg}${COLORS.reset}`, "cyan");
}

function success(msg) {
  log(`  ✓ ${msg}`, "green");
}

function warn(msg) {
  log(`  ⚠ ${msg}`, "yellow");
}

function error(msg) {
  log(`  ✗ ${msg}`, "red");
}

function info(msg) {
  log(`  ℹ ${msg}`, "blue");
}

function banner(title) {
  const line = "═".repeat(Math.max(title.length + 4, 40));
  log(`\n${COLORS.bold}${COLORS.cyan}╔${line}╗${COLORS.reset}`);
  log(`${COLORS.bold}${COLORS.cyan}║${" ".repeat((line.length - title.length - 2) / 2)}${COLORS.yellow}${title}${COLORS.cyan}${" ".repeat((line.length - title.length - 1) / 2)}║${COLORS.reset}`);
  log(`${COLORS.bold}${COLORS.cyan}╚${line}╝${COLORS.reset}`);
}

function runSync(cmd, args, cwd = ROOT, env = process.env) {
  return spawnSync(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function runCapture(cmd, args, cwd = ROOT, env = process.env) {
  return spawnSync(cmd, args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
    encoding: "utf-8",
  });
}

function runAsync(cmd, args, cwd = ROOT, env = process.env) {
  return spawn(cmd, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function isWin() {
  return process.platform === "win32";
}

function venvBin(name) {
  if (isWin()) {
    return path.join(BACKEND_DIR, ".venv", "Scripts", `${name}.exe`);
  }
  return path.join(BACKEND_DIR, ".venv", "bin", name);
}

function venvExists() {
  return fs.existsSync(venvBin("python")) || fs.existsSync(venvBin("python3"));
}

function pythonBin() {
  if (venvExists()) {
    return venvBin("python");
  }
  return isWin() ? "python" : "python3";
}

function pipBin() {
  if (venvExists()) {
    return venvBin("pip");
  }
  return isWin() ? "pip" : "pip3";
}

function nodeBin() {
  return "npm";
}

function fileExists(p) {
  return fs.existsSync(p);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 60000, intervalMs = 2000) {
  const start = Date.now();
  const http = url.startsWith("https") ? require("https") : require("http");
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(url, { timeout: 3000 }, (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return true;
    } catch {
      // ignore
    }
    await sleep(intervalMs);
  }
  return false;
}

module.exports = {
  ROOT,
  BACKEND_DIR,
  FRONTEND_DIR,
  COLORS,
  log,
  step,
  success,
  warn,
  error,
  info,
  banner,
  runSync,
  runCapture,
  runAsync,
  isWin,
  venvBin,
  venvExists,
  pythonBin,
  pipBin,
  nodeBin,
  fileExists,
  sleep,
  waitForHttp,
};
