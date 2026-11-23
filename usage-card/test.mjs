// mods/usage-card/main.js with the app's functions faked: who is signed in, the menu, the sign-in tabs.
// node test.mjs
import assert from "node:assert";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./mods/usage-card/main.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace("export default class", "return class");
const clicks = {}, texts = []; let p;
const el = () => new Proxy(function () {}, { get: (t, k) => (...a) => { if (k === "id") t.__id = a[0]; if (k === "on_click") clicks[t.__id] = a[0]; if (k === "child" && typeof a[0] === "string") texts.push(a[0]); if (k === "when" && a[0]) a[1](p); return p; } });
const mk = () => (p = el());
const sh = { "usage-limits.state": { claude: { report: { status: "ok", plan: "max", windows: [{ short: "wk", percent: 36, resetsAt: 9e9, durationSec: 604800 }] } }, "claude-personal": { report: { status: "unavailable", message: "No subscription limits", windows: [] } } } };
const calls = [], ran = [];
const env = { View: class {}, div: mk, h_flex: mk, v_flex: mk, layout: () => ({}), run: (n, a) => { ran.push([n, a]); return null; }, spaces: () => [{ active: true, machine: "devbox" }],
  props: () => ({ names: { claude: "Claude Work" }, configDirs: { "claude-personal": "~/.claude-personal" } }), openOverlay: () => "o", closeOverlay: () => null,
  exec: async (c, a) => { calls.push(a[1]); return { code: 0, stdout: JSON.stringify(a[1].includes("personal") ? { loggedIn: false } : { loggedIn: true, email: "me@example.com", orgName: "Org", subscriptionType: "max" }) }; },
  shared: (k) => sh[k], setShared: (k, v) => { sh[k] = v; return null; }, theme: () => new Proxy({}, { get: () => "#000" }), checking: () => false };
const C = new Function(...Object.keys(env), src)(...Object.values(env));
const v = new C(); let pending = [];
const cx = { timer: { every() {} }, spawn: (f) => pending.push(f(cx)), notify() {} };
v.init({}, cx); await Promise.all(pending);
v.render();
assert.deepEqual(calls, ["claude auth status --json", 'CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude auth status --json'], "each account is asked in its own folder");
assert.ok(texts.includes("me@example.com"), "the card names who is signed in");
texts.length = 0; v.menu();
assert.ok(texts.includes("Switch account…") && texts.includes("Switch account on devbox…"), "the menu offers the switch, here and on the shown space's machine");
clicks["switch"](); clicks["switch-remote"]();
assert.deepEqual(ran, [["space.new", { name: "Claude sign-in", machine: "", argv: ["claude", "auth", "login"] }],
  ["tab.new", { name: "Claude sign-in", argv: ["claude", "auth", "login"] }]], "switching opens Claude's own sign-in, here or in the shown space");
console.log("ok");
