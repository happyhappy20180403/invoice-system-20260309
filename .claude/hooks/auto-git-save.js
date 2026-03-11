#!/usr/bin/env node
/**
 * Auto Git Save Hook
 * - PostToolUse (Write|Edit): Debounced auto-commit & push
 * - Stop / SessionEnd: Immediate commit & push of all changes
 *
 * Uses a timestamp file to debounce PostToolUse commits (every 5 min max).
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEBOUNCE_FILE = path.join(__dirname, "data", "last-auto-save.json");
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

function getProjectRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function hasChanges(root) {
  try {
    const status = execSync("git status --porcelain", { cwd: root, encoding: "utf-8" }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function commitAndPush(root, message) {
  try {
    execSync("git add -A", { cwd: root, stdio: "pipe" });
    execSync(`git commit -m "${message}"`, { cwd: root, stdio: "pipe" });
    execSync("git push origin HEAD 2>&1", { cwd: root, stdio: "pipe", timeout: 30000 });
    process.stderr.write(`[Auto-Save] Committed and pushed: ${message}\n`);
    return true;
  } catch (e) {
    // No changes to commit is OK
    if (e.message && e.message.includes("nothing to commit")) {
      return false;
    }
    process.stderr.write(`[Auto-Save] Warning: ${e.message?.split("\n")[0] || "unknown error"}\n`);
    return false;
  }
}

function shouldDebounce() {
  try {
    if (!fs.existsSync(DEBOUNCE_FILE)) return false;
    const data = JSON.parse(fs.readFileSync(DEBOUNCE_FILE, "utf-8"));
    return Date.now() - data.lastSave < DEBOUNCE_MS;
  } catch {
    return false;
  }
}

function updateDebounce() {
  try {
    const dir = path.dirname(DEBOUNCE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEBOUNCE_FILE, JSON.stringify({ lastSave: Date.now() }));
  } catch { /* ignore */ }
}

function main() {
  const root = getProjectRoot();
  if (!root) return;
  if (!hasChanges(root)) return;

  // Detect hook type from environment or args
  const hookType = process.env.CLAUDE_HOOK_EVENT || process.argv[2] || "post";

  if (hookType === "Stop" || hookType === "SessionEnd" || hookType === "stop" || hookType === "session-end") {
    // Session ending - immediate save
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    commitAndPush(root, `Auto-save: session end (${timestamp})`);
    updateDebounce();
  } else {
    // PostToolUse - debounced save
    if (shouldDebounce()) return;
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    if (commitAndPush(root, `Auto-save: work in progress (${timestamp})`)) {
      updateDebounce();
    }
  }
}

main();
