// The account switch of mods/usage-card/main.js, with the app's functions faked: node test.mjs
import assert from "node:assert";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./mods/usage-card/main.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace("export default class", "return class");
const clicks = {}; let p;
const el = () => new Proxy(function () {}, { get: (t, k) => (...a) => { if (k === "id") t.__id = a[0]; if (k === "on_click") clicks[t.__id] = a[0]; if (k === "when" && a[0]) a[1](p); return p; } });
const mk = () => (p = el());
const state = { claude: { report: { status: "ok", plan: "max", windows: [{ short: "wk", percent: 36, resetsAt: 9e9, durationSec: 604800 }] } },
  "claude-personal": { report: { status: "unavailable", message: "No subscription limits", windows: [] } }, codex: { report: null } };
const sh = { "usage-limits.state": state };
const env = { View: class {}, div: mk, h_flex: mk, v_flex: mk, layout: () => ({}), props: () => ({ names: { claude: "Claude Work" } }), run: () => null,
  shared: (k) => sh[k], setShared: (k, v) => { sh[k] = v; return null; }, theme: () => new Proxy({}, { get: () => "#000" }), checking: () => true };
const C = new Function(...Object.keys(env), src)(...Object.values(env));
const v = new C(); v.init({}, {});
const seen = [];
for (let i = 0; i < 4; i++) { v.render(); seen.push(v.providers().map((x) => x.id).join("+")); (clicks["account-claude"] ?? clicks["account-claude-personal"])(); delete clicks["account-claude"]; delete clicks["account-claude-personal"]; }
assert.deepEqual(seen, ["claude", "claude-personal", "claude+claude-personal", "claude"], "a click shows the next account, then all, then the first");
console.log("ok");
