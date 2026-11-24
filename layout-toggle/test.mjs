// mods/layout-toggle/main.js with the app's functions faked: which parts can get a button, adding and
// removing one, the old single-button props, and placing the block in the tab bar. node test.mjs
import assert from "node:assert";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./mods/layout-toggle/main.js", import.meta.url), "utf8").replace(/^import .*$/gm, "").replace("export default class", "return { addToTabBar, candidates, View: class");
const clicks = {}; let p;
const el = () => new Proxy(function () {}, { get: (t, k) => (...a) => { if (k === "id") t.__id = a[0]; if (k === "on_click") clicks[t.__id] = a[0]; if (k === "when" && a[0]) a[1](p); return p; } });
const mk = () => (p = el());
let tree = { id: "root", type: "row", children: [
  { id: "sidebar", type: "column", children: [{ id: "spaces", type: "block", content: { mod: "spaces" } }, { id: "agents", type: "block", hidden: true, content: { mod: "agents" } }] },
  { id: "work", type: "column", children: [{ id: "tabs", type: "block", size: { px: 42 }, content: { mod: "tabs" } },
    { id: "work-body", type: "row", children: [{ id: "main", type: "block", content: { tab: "active" } }, { id: "pr-flow", type: "block", content: { mod: "pr-flow" } }] }] } ] };
const sh = {}, ran = [];
let view = { id: "pr-flow", label: "Pull requests" };
const env = { View: class {}, div: mk, h_flex: mk, v_flex: mk, InputState: { new: () => ({ on() {}, focus() {}, set_selected_range() {}, value: () => "" }) }, Input: { new: mk },
  layout: () => tree, props: () => view, run: (n, a) => { ran.push(n); if (n === "layout.set") tree = a.layout; return null; }, openOverlay: () => "o",
  shared: (k) => sh[k], setShared: (k, v) => { sh[k] = v; return null; }, theme: () => new Proxy({}, { get: () => "#000" }), checking: () => false };
const { addToTabBar, candidates, View: C } = new Function(...Object.keys(env), src + " }")(...Object.values(env));

addToTabBar();
const row = tree.children[1].children[0];
assert.deepEqual([row.id, ...row.children.map((c) => c.id)], ["tabs-row", "tabs", "layout-toggle"], "the tab bar becomes a row that keeps Herdr's tabs");

const v = new C(); v.init();
assert.deepEqual(sh["layout-toggle.buttons"], [{ id: "pr-flow", label: "Pull requests" }], "one button given in props becomes the first button");
const ids = candidates().map((c) => c.id);
assert.ok(ids.includes("sidebar") && ids.includes("agents") && ids.includes("main"), "any named part can get a button");
for (const no of ["root", "work", "tabs-row", "layout-toggle", "pr-flow"]) assert.ok(!ids.includes(no), `${no} is not offered: the window, what holds the buttons, or a part that has one`);
assert.equal(candidates().find((c) => c.id === "agents").hidden, true);

view = { view: "settings" }; v.render();
clicks["add-sidebar"]();
assert.deepEqual(sh["layout-toggle.buttons"].map((b) => b.label), ["Pull requests", "Sidebar"]);
v.render(); clicks["del-0"]();
assert.deepEqual(sh["layout-toggle.buttons"], [{ id: "sidebar", label: "Sidebar" }]);

view = {}; v.render(); clicks["toggle-0"]();
assert.deepEqual(ran.slice(-2), ["layout.resize", "layout.toggle"], "the bar sizes itself, and a button toggles its part");
console.log("ok");
