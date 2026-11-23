import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, layout, openOverlay, closeOverlay, props, run, shared, setShared, spaces, theme, checking } from "herdr";

// Plan limits as a card in the sidebar, like the machine-pulse card: one row a limit with a bar, the
// percent used and the time to reset. It reads what the usage-limits mod publishes in shared state
// ("usage-limits.state"), so that mod must be in the layout too; this one asks nobody anything.
// It also shows which account is signed in (`claude auth status`), and a click on the account opens a
// small menu to switch: Claude's own sign-in (`claude auth login`) in a new tab.
// Props: { names: { "<provider id>": "Label" }, configDirs: { "<provider id>": "~/.claude-work" } }.
const MOD = "usage-card";
const NAMES = { claude: "Claude", codex: "Codex", "opencode-go": "OpenCode Go", agy: "Antigravity" };
const isClaude = (id) => id === "claude" || id.startsWith("claude-");
const REFRESH = "usage-limits.refresh"; // shared: set to now to make usage-limits ask again
const dirOf = (id) => props()?.configDirs?.[id] ?? null; // null: Claude Code's default folder
// Who is signed in, per Claude account, on this computer: where usage-limits measures. Shared by copies.
const auth = { who: {}, at: 0, rev: 0, watchUntil: 0 };
async function loadAuth(ids) {
  for (const id of ids) {
    const dir = dirOf(id);
    if (id !== "claude" && !dir) continue; // an extra account whose folder we were not told: say nothing rather than guess
    const cmd = `${dir ? `CLAUDE_CONFIG_DIR="${String(dir).replace(/^~/, "$HOME")}" ` : ""}claude auth status --json`;
    const r = await exec("sh", ["-c", cmd], { timeout: 15_000 }).catch(() => null);
    let now = null;
    try { const j = JSON.parse(r?.stdout ?? ""); now = j.loggedIn ? { email: j.email ?? "", org: j.orgName ?? "", plan: j.subscriptionType ?? "" } : { email: "", signedOut: true }; } catch { /* claude missing or old: no line */ }
    const before = auth.who[id]?.email;
    auth.who[id] = now;
    // A different account signed in: the limits on show are the old account's, so ask again.
    if (now && before !== undefined && before !== now.email) setShared(REFRESH, Date.now());
  }
  auth.at = Date.now();
  auth.rev++;
}
const nameOf = (id) => props()?.names?.[id] ?? NAMES[id] ?? (isClaude(id) ? `Claude ${id.slice(7).replace(/^./, (c) => c.toUpperCase())}` : id);

const left = (sec) => (sec >= 86400 ? `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
  : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.max(0, Math.floor(sec / 60))}m`);

const find = (node, pred) => (!node ? null : pred(node) ? node : (node.children || []).map((c) => find(c, pred)).find(Boolean));

export default class UsageCard extends View {
  init(_props, cx) {
    this.rev = -1;
    if (checking()) return;
    cx.timer.every(60_000, (cx) => cx.notify()); // the time to reset moves on
    cx.timer.every(5000, (cx) => this.tick(cx));
    this.tick(cx);
  }

  // Asks who is signed in: every 5 minutes, and every 5 seconds for a while after a sign-in tab opened.
  tick(cx) {
    cx.spawn(async (cx) => {
      const every = Date.now() < auth.watchUntil ? 5000 : 300_000;
      if (Date.now() - auth.at >= every - 100 && !auth.busy) {
        auth.busy = true;
        try { await loadAuth(this.accounts().length ? this.accounts() : ["claude"]); } finally { auth.busy = false; }
      }
      if (this.rev !== auth.rev) { this.rev = auth.rev; cx.notify(); }
    });
  }

  // Opens Claude's own sign-in in a new tab: on this computer (a new space) or in the shown space.
  signIn(id, here) {
    const dir = dirOf(id);
    const argv = dir ? ["sh", "-c", `CLAUDE_CONFIG_DIR="${String(dir).replace(/^~/, "$HOME")}" claude auth login`] : ["claude", "auth", "login"];
    if (here) run("space.new", { name: "Claude sign-in", machine: "", argv });
    else run("tab.new", { name: "Claude sign-in", argv });
    auth.watchUntil = Date.now() + 5 * 60_000;
    closeOverlay(props()?.overlay);
  }

  // The clicked account and how to switch it: one entry, two when the shown space is on another machine.
  menu() {
    const t = theme(), id = props()?.account ?? "claude", who = auth.who[id];
    const remote = spaces().find((s) => s.active)?.machine ?? null;
    const item = (key, label, click) => div().id(key).px(8).py(6).rounded(4).hover((s) => s.bg(t.hover)).on_click(click).child(label);
    return v_flex().size_full().p(8).bg(t.popover).text_size(12.5).text_color(t.foreground)
      .child(h_flex().px(8).gap(6).child(div().font_semibold().child(nameOf(id))).child(div().text_color(t.dim).child(who?.plan ?? "")))
      .child(div().px(8).pb(6).text_color(t.muted).truncate().child(who ? (who.signedOut ? "Not signed in" : who.email || "Signed in") : "…"))
      .child(item("switch", who?.signedOut ? "Sign in…" : "Switch account…", () => this.signIn(id, true)))
      .when(Boolean(remote), (el) => el.child(item("switch-remote", `Switch account on ${remote}…`, () => this.signIn(id, false))))
      .child(div().px(8).pt(8).text_color(t.dim).text_size(11).child(remote
        ? `Usage shown is this computer's account. Agents on ${remote} use the account signed in there.`
        : "Opens Claude's sign-in in a new tab."));
  }

  // Every Claude account usage-limits knows, signed in or not.
  accounts() {
    return Object.keys(shared("usage-limits.state") || {}).filter(isClaude);
  }

  // What the card shows: every Claude account, then the other providers that have limits. A failed
  // report falls back to the last good one; an account with no limits says why.
  providers() {
    const state = shared("usage-limits.state") || {};
    // usage-limits keeps an account it no longer asks about; leave out what hasn't been heard of lately.
    const seen = (p) => p.report?.observedAt ?? 0, newest = Math.max(0, ...Object.values(state).map(seen));
    return Object.entries(state).filter(([, p]) => !seen(p) || newest - seen(p) < 660).map(([id, p]) => ({ id, plan: (p.report ?? p.lastGood)?.plan, stale: p.report?.status !== "ok",
      note: p.report?.message, windows: (p.report?.windows?.length ? p.report : p.lastGood)?.windows ?? [] }))
      .filter((p) => isClaude(p.id) || p.windows.length);
  }

  // Keeps the block as tall as the card, as machine-pulse does.
  fit(list) {
    const want = list.length ? 21 + list.reduce((h, p) => h + 17 + (isClaude(p.id) && auth.who[p.id] ? 19 : 0) + 22 * Math.max(1, p.windows.length), 0) + 10 * (list.length - 1) : 44;
    if (want === this.want) return;
    this.want = want;
    const node = find(layout(), (n) => n.content?.mod === MOD);
    if (node) run("layout.resize", { id: node.id, px: want });
  }

  render() {
    if (props()?.view === "menu" || (props()?.overlay && !props()?.view)) return this.menu(); // also: mod.open usage-card
    const t = theme(), now = Date.now() / 1000, list = this.providers();
    this.fit(list);
    const remote = Boolean(spaces().find((s) => s.active)?.machine);
    const open = (id) => openOverlay({ mod: MOD, props: { ...props(), view: "menu", account: id }, kind: "dialog", width: 280, height: remote ? 176 : 124 });
    const tone = (p) => (p >= 90 ? t.ansi1 : p >= 75 ? t.ansi3 : t.ansi2);
    const W = 96;
    const who = (p) => (isClaude(p.id) ? auth.who[p.id] : null);
    const title = (p) => (isClaude(p.id)
      ? h_flex().id(`account-${p.id}`).gap(5).items_center().rounded(4).hover((s) => s.bg(t.hover)).on_click(() => open(p.id))
        .child(div().text_color(t.foreground).font_semibold().child(nameOf(p.id))).child(div().text_color(t.dim).child("⇄"))
      : div().text_color(t.foreground).font_semibold().child(nameOf(p.id)));
    const rows = list.map((p) => v_flex().gap(4)
      .child(h_flex().justify_between().child(title(p))
        .child(div().text_color(t.dim).child(`${p.plan ?? ""}${p.stale && p.windows.length ? " · old" : ""}`)))
      .when(Boolean(who(p)), (el) => el.child(div().h(15).text_color(t.muted).truncate().child(who(p).signedOut ? "Not signed in" : who(p).email || "Signed in")))
      .when(!p.windows.length, (el) => el.child(div().h(18).text_color(t.dim).truncate().child(p.note ?? "No limits reported")))
      .children(p.windows.map((w) => {
        // The mark is where the bar would be if usage kept an even pace through the window.
        const pace = w.durationSec ? Math.min(1, Math.max(0, 1 - (w.resetsAt - now) / w.durationSec)) : null;
        return h_flex().h(18).gap(8).items_center()
          .child(div().w(44).truncate().text_color(t.dim).child(w.short ?? w.long ?? ""))
          .child(div().relative().w(W).h(5).rounded(2).bg(t.border)
            .child(div().h_full().w((Math.min(100, w.percent) * W) / 100).rounded(2).bg(tone(w.percent)))
            .when(pace != null, (el) => el.child(div().absolute().top(-2).left(pace * W).w(1).h(9).bg(t.muted))))
          .child(div().w(30).text_color(t.foreground).child(`${Math.round(w.percent)}%`))
          .child(div().flex_1().text_color(t.dim).child(w.resetsAt ? left(w.resetsAt - now) : ""));
      })));
    return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(14).py(10).gap(10).text_size(11.5)
      .children(rows.length ? rows : [div().text_color(t.dim).child("No limits yet (needs the usage-limits mod)")]);
  }
}
