import { View, div } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { layout, props, run, shared, setShared, openOverlay, theme, checking } from "herdr";

// Buttons that show or hide parts of the layout, each lit while its part is shown. The `+` at the
// end opens the settings: pick any part of the layout to get a button, rename it, remove it.
// The buttons are kept in shared state, so nothing has to be written in the layout file.
// Older setups gave one button in props ({ id, label }); it becomes the first button.
const MOD = "layout-toggle";
const KEY = "layout-toggle.buttons"; // shared: [{ id, label }]
const NAMES = { "pr-flow": "Pull requests", files: "Files", changes: "Changes", spaces: "Spaces", agents: "Agents", "machine-pulse": "Machines", "usage-card": "Usage" };
const pretty = (s) => String(s).replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

const buttons = () => shared(KEY) ?? [];
const find = (node, pred, path = []) => {
  if (!node) return null;
  if (pred(node)) return { node, path };
  for (const child of node.children || []) { const hit = find(child, pred, [...path, node]); if (hit) return hit; }
  return null;
};
const own = () => find(layout(), (n) => n.content?.mod === MOD);

// The parts a button can be made for: every named node except the window itself, the block these
// buttons are in and what contains it (hiding those would hide the buttons), and ones that have one.
function candidates() {
  const me = own(), skip = new Set([...(me ? [me.node, ...me.path] : [])].map((n) => n.id)), have = new Set(buttons().map((b) => b.id));
  const out = [];
  const walk = (node, depth, hidden) => {
    hidden ||= node.hidden === true;
    if (node.id && depth > 0 && !skip.has(node.id) && !have.has(node.id)) {
      const mod = node.content?.mod;
      out.push({ id: node.id, label: NAMES[mod] ?? NAMES[node.id] ?? pretty(node.id), what: mod ?? (node.content?.tab ? "terminals" : node.type), hidden });
    }
    for (const child of node.children || []) walk(child, depth + 1, hidden);
  };
  if (layout()) walk(layout(), 0, false);
  return out;
}

// Puts the buttons at the right end of the tab bar's row, in layouts shaped like Herdr's main one.
// Shipped layouts refuse structure changes, so this needs a layout of your own.
function addToTabBar() {
  const tree = JSON.parse(JSON.stringify(layout()));
  const block = { id: "layout-toggle", type: "block", size: { px: 60 }, content: { mod: MOD } };
  const row = find(tree, (n) => n.id === "tabs-row")?.node, tabs = find(tree, (n) => n.id === "tabs");
  if (row) row.children.push(block);
  else if (tabs && tabs.path.length) {
    const parent = tabs.path[tabs.path.length - 1];
    parent.children[parent.children.indexOf(tabs.node)] = { id: "tabs-row", type: "row", size: tabs.node.size ?? { px: 42 }, resizable: false, children: [{ ...tabs.node, size: { weight: 1 } }, block] };
  } else return null;
  return run("layout.set", { layout: tree });
}

export default class LayoutToggle extends View {
  init() {
    this.editing = null; // the button being renamed
    if (checking()) return;
    const p = props();
    if (p?.id && shared(KEY) == null) setShared(KEY, [{ id: p.id, label: p.label ?? pretty(p.id) }]);
  }

  // Keeps the block as wide as its buttons.
  fit(list) {
    const want = Math.round(12 + 26 + list.reduce((w, b) => w + b.label.length * 7.4 + 20, 0));
    if (want === this.want) return;
    this.want = want;
    const me = own();
    if (me) run("layout.resize", { id: me.node.id, px: want });
  }

  rename(index) {
    const list = buttons();
    this.editing = index;
    this.input = InputState.new({ value: list[index].label });
    this.input.set_selected_range({ start: 0, end: list[index].label.length });
    this.input.on("submit", (_e, cx) => {
      const label = this.input.value().trim();
      if (label) setShared(KEY, buttons().map((b, i) => (i === index ? { ...b, label } : b)));
      this.editing = null;
      cx.notify();
    });
    this.input.focus();
  }

  settings() {
    const t = theme(), list = buttons(), more = candidates();
    const head = (text) => div().px(8).pt(10).pb(3).text_color(t.dim).text_size(11).child(text);
    const small = (id, text, click) => div().id(id).px(6).py(2).rounded(4).text_color(t.muted).hover((s) => s.bg(t.hover)).on_click(click).child(text);
    return v_flex().size_full().p(8).bg(t.popover).text_size(12.5).text_color(t.foreground).overflow_y_scrollbar()
      .child(div().px(8).font_semibold().child("Toggle buttons"))
      .when(!own(), (el) => el.child(div().px(8).pt(8).child(div().id("place").px(8).py(5).rounded(4).border(1).border_color(t.accent).hover((s) => s.bg(t.hover))
        .on_click(() => addToTabBar()).child("Add the buttons to the tab bar"))))
      .child(head(list.length ? "Buttons (click a name to rename it)" : "No buttons yet"))
      .children(list.map((b, i) => h_flex().px(8).py(3).gap(8).items_center()
        .child(this.editing === i
          ? Input.new(this.input).flex_1().h(24).px(6).rounded(4).border(1).border_color(t.accent).bg(t.background).text_size(12.5).text_color(t.foreground)
          : div().id(`name-${i}`).flex_1().rounded(4).hover((s) => s.bg(t.hover)).on_click((_e, cx) => { this.rename(i); cx.notify(); }).child(b.label))
        .child(div().text_color(t.dim).text_size(11).child(b.id))
        .child(small(`del-${i}`, "✕", () => setShared(KEY, buttons().filter((_b, j) => j !== i))))))
      .child(head("Add a button for"))
      .children(more.map((c) => h_flex().id(`add-${c.id}`).px(8).py(4).gap(8).items_center().rounded(4).hover((s) => s.bg(t.hover))
        .on_click(() => setShared(KEY, [...buttons(), { id: c.id, label: c.label }]))
        .child(div().flex_1().child(c.label))
        .child(div().text_color(t.dim).text_size(11).child(`${c.what}${c.hidden ? " · hidden" : ""}`))));
  }

  render() {
    const p = props();
    if (p?.view === "settings" || (p?.overlay && !p?.view)) return this.settings(); // also: mod.open layout-toggle
    const t = theme(), list = buttons();
    this.fit(list);
    const shown = (id) => { const hit = find(layout(), (n) => n.id === id); return Boolean(hit) && ![hit.node, ...hit.path].some((n) => n.hidden === true); };
    const button = (id, label, lit, click) => div().id(id).px(8).py(3).rounded(5).text_size(12.5).text_color(lit ? t.foreground : t.muted)
      .when(lit, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click(click).child(label);
    return h_flex().size_full().px(6).gap(4).items_center().justify_end().bg(t.chrome).border_b(1).border_color(t.border)
      .children(list.map((b, i) => button(`toggle-${i}`, b.label, shown(b.id), () => run("layout.toggle", { id: b.id }))))
      .child(button("edit", "+", false, () => openOverlay({ mod: MOD, props: { view: "settings" }, kind: "dialog", width: 330, height: 440 })));
  }
}
