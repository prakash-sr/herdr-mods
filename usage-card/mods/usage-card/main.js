import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { layout, props, run, shared, setShared, theme, checking } from "herdr";

// Plan limits as a card in the sidebar, like the machine-pulse card: one row a limit with a bar, the
// percent used and the time to reset. It reads what the usage-limits mod publishes in shared state
// ("usage-limits.state"), so that mod must be in the layout too; this one asks nobody anything.
// With several Claude accounts (usage-limits' `claudeAccounts`), the card shows one at a time: a click
// on its name switches to the next, then to all of them. Props: { names: { "<provider id>": "Label" } }.
const MOD = "usage-card";
const NAMES = { claude: "Claude", codex: "Codex", "opencode-go": "OpenCode Go", agy: "Antigravity" };
const ACCOUNT = "usage-card.account"; // shared: the Claude account shown, or "all"
const isClaude = (id) => id === "claude" || id.startsWith("claude-");
const nameOf = (id) => props()?.names?.[id] ?? NAMES[id] ?? (isClaude(id) ? `Claude ${id.slice(7).replace(/^./, (c) => c.toUpperCase())}` : id);

const left = (sec) => (sec >= 86400 ? `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
  : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.max(0, Math.floor(sec / 60))}m`);

const find = (node, pred) => (!node ? null : pred(node) ? node : (node.children || []).map((c) => find(c, pred)).find(Boolean));

export default class UsageCard extends View {
  init(_props, cx) {
    if (checking()) return;
    cx.timer.every(60_000, (cx) => cx.notify()); // the time to reset moves on
  }

  // Every Claude account usage-limits knows, signed in or not.
  accounts() {
    return Object.keys(shared("usage-limits.state") || {}).filter(isClaude);
  }

  // What the card shows: the chosen Claude account (or all), then the other providers that have
  // limits. A failed report falls back to the last good one; an account with no limits says why.
  providers() {
    const state = shared("usage-limits.state") || {}, accounts = this.accounts();
    const chosen = shared(ACCOUNT), one = accounts.includes(chosen) ? chosen : chosen === "all" ? null : accounts[0];
    return Object.entries(state).map(([id, p]) => ({ id, plan: (p.report ?? p.lastGood)?.plan, stale: p.report?.status !== "ok",
      note: p.report?.message, windows: (p.report?.windows?.length ? p.report : p.lastGood)?.windows ?? [] }))
      .filter((p) => (isClaude(p.id) ? !one || p.id === one : p.windows.length));
  }

  // The next account, then all, then the first again.
  switchAccount() {
    const accounts = this.accounts(), chosen = shared(ACCOUNT);
    const at = accounts.includes(chosen) ? accounts.indexOf(chosen) : chosen === "all" ? accounts.length : 0;
    setShared(ACCOUNT, at + 1 < accounts.length ? accounts[at + 1] : at + 1 === accounts.length ? "all" : accounts[0]);
  }

  // Keeps the block as tall as the card, as machine-pulse does.
  fit(list) {
    const want = list.length ? 21 + list.reduce((h, p) => h + 17 + 22 * Math.max(1, p.windows.length), 0) + 10 * (list.length - 1) : 44;
    if (want === this.want) return;
    this.want = want;
    const node = find(layout(), (n) => n.content?.mod === MOD);
    if (node) run("layout.resize", { id: node.id, px: want });
  }

  render() {
    const t = theme(), now = Date.now() / 1000, list = this.providers();
    this.fit(list);
    const tone = (p) => (p >= 90 ? t.ansi1 : p >= 75 ? t.ansi3 : t.ansi2);
    const W = 96;
    const many = this.accounts().length > 1;
    const title = (p) => (many && isClaude(p.id)
      ? h_flex().id(`account-${p.id}`).gap(5).items_center().rounded(4).hover((s) => s.bg(t.hover)).on_click(() => this.switchAccount())
        .child(div().text_color(t.foreground).font_semibold().child(nameOf(p.id))).child(div().text_color(t.dim).child("⇄"))
      : div().text_color(t.foreground).font_semibold().child(nameOf(p.id)));
    const rows = list.map((p) => v_flex().gap(4)
      .child(h_flex().justify_between().child(title(p))
        .child(div().text_color(t.dim).child(`${p.plan ?? ""}${p.stale && p.windows.length ? " · old" : ""}`)))
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
