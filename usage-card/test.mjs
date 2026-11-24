// mods/usage-card/main.js with the app's functions faked: who is signed in to each vendor, the switch
// menu, and the sign-in tabs. node test.mjs
import assert from "node:assert";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./mods/usage-card/main.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace("export default class", "return class");
const clicks = {}, texts = []; let p;
const el = () => new Proxy(function () {}, { get: (t, k) => (...a) => { if (k === "id") t.__id = a[0]; if (k === "on_click") clicks[t.__id] = a[0]; if (k === "child" && typeof a[0] === "string") texts.push(a[0]); if (k === "when" && a[0]) a[1](p); return p; } });
const mk = () => (p = el());
const win = [{ short: "wk", percent: 36, resetsAt: 9e9, durationSec: 604800 }];
const sh = { "usage-limits.state": { claude: { report: { status: "ok", plan: "max", windows: win } }, "claude-work": { report: { status: "ok", windows: win } },
  "claude-other": { report: { status: "ok", windows: win } }, codex: { report: { status: "ok", plan: "plus", windows: win } }, mytool: { report: { status: "ok", windows: win } } } };
let view = {};
const calls = [], ran = [];
const answers = { "claude auth status --json": { code: 0, stdout: JSON.stringify({ loggedIn: true, email: "me@example.com", subscriptionType: "max" }) },
  'CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude auth status --json': { code: 0, stdout: JSON.stringify({ loggedIn: false }) },
  "codex login status": { code: 0, stdout: "Logged in using ChatGPT\n" }, "mytool whoami": { code: 0, stdout: "ada - sk-123\n" } };
const env = { View: class {}, div: mk, h_flex: mk, v_flex: mk, layout: () => ({}), run: (n, a) => { ran.push([n, a]); return null; }, spaces: () => [{ active: true, machine: "devbox" }],
  props: () => ({ configDirs: { "claude-work": "~/.claude-work" }, vendors: { mytool: { name: "My Tool", status: "mytool whoami", login: "mytool login --device" } }, ...view }),
  openOverlay: () => "o", closeOverlay: () => null, exec: async (c, a) => { calls.push(a[1]); return answers[a[1]] ?? { code: 127, stdout: "" }; },
  shared: (k) => sh[k], setShared: (k, v) => { sh[k] = v; return null; }, theme: () => new Proxy({}, { get: () => "#000" }), checking: () => false };
const C = new Function(...Object.keys(env), src)(...Object.values(env));
const v = new C(), pending = [];
const cx = { timer: { every() {} }, spawn: (f) => pending.push(f(cx)), notify() {} };

v.init({}, cx); await Promise.all(pending);
v.render();
assert.deepEqual(calls, ["claude auth status --json", 'CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude auth status --json', "codex login status", "mytool whoami"],
  "each vendor is asked with its own command; a Claude account whose folder is unknown is not asked");
for (const want of ["me@example.com", "Not signed in", "Logged in using ChatGPT", "ada", "My Tool"]) assert.ok(texts.includes(want), `the card shows "${want}"`);
assert.ok(!texts.some((t) => t.includes("sk-")), "a key hint in a status line is not shown");
assert.ok(clicks["account-codex"] && clicks["account-mytool"] && !clicks["account-claude-other"], "a vendor is clickable when the card knows how to sign in to it");

view = { view: "menu", account: "codex" }; texts.length = 0; v.menu();
assert.ok(texts.includes("Codex") && texts.includes("Switch account…") && texts.includes("Switch account on devbox…"), "the menu is the clicked vendor's");
clicks["switch"](); clicks["switch-remote"]();
view = { view: "menu", account: "claude-work" }; v.menu(); clicks["switch"]();
view = { view: "menu", account: "mytool" }; v.menu(); clicks["switch"]();
assert.deepEqual(ran, [["space.new", { name: "Codex sign-in", machine: "", argv: ["codex", "login"] }], ["tab.new", { name: "Codex sign-in", argv: ["codex", "login"] }],
  ["space.new", { name: "Claude Work sign-in", machine: "", argv: ["sh", "-c", 'CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude auth login'] }],
  ["space.new", { name: "My Tool sign-in", machine: "", argv: ["mytool", "login", "--device"] }]], "switching opens the vendor's own sign-in, here or in the shown space");
console.log("ok");
