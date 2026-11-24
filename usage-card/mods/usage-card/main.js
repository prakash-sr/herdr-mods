import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, layout, openOverlay, closeOverlay, props, run, shared, setShared, spaces, theme, checking } from "herdr";

// Plan limits as a card in the sidebar, like the machine-pulse card: one row a limit with a bar, the
// percent used and the time to reset. The limits are what the usage-limits mod publishes in shared
// state ("usage-limits.state"), so that mod must be in the layout too.
// The card also says who is signed in to each vendor, and a click on a vendor opens a small menu to
// switch account: the vendor's own sign-in command in a new tab.
// Props: { names: { "<provider id>": "Label" }, configDirs: { "<claude id>": "~/.claude-work" },
//          vendors: { "<provider id>": { status: "cmd", login: "cmd" } } } (adds or replaces a vendor).
const MOD = "usage-card";
const REFRESH = "usage-limits.refresh"; // shared: set to now to make usage-limits ask again

// What the card knows about a vendor: its name, the command that says who is signed in, and the one
// that signs in. `status` prints JSON ({ loggedIn, email, subscriptionType }) or a line of text.
const VENDORS = {
  claude: { name: "Claude", status: "claude auth status --json", login: "claude auth login" },
  codex: { name: "Codex", status: "codex login status", login: "codex login" },
  "opencode-go": { name: "OpenCode Go", login: "opencode auth login" },
  agy: { name: "Antigravity" },
};
const isClaude = (id) => id === "claude" || id.startsWith("claude-");
// A Claude account in its own config folder runs the same commands with CLAUDE_CONFIG_DIR set; one
// whose folder we were not told gets no commands, rather than the default account's by mistake.
function vendor(id) {
  const own = props()?.vendors?.[id];
  if (isClaude(id) && id !== "claude") {
    const dir = props()?.configDirs?.[id];
    const env = dir ? `CLAUDE_CONFIG_DIR="${String(dir).replace(/^~/, "$HOME")}" ` : null;
    const base = { name: `Claude ${id.slice(7).replace(/^./, (c) => c.toUpperCase())}`, ...(env ? { status: env + VENDORS.claude.status, login: env + VENDORS.claude.login } : {}) };
    return { ...base, ...own };
  }
  return { name: id, ...VENDORS[id], ...own };
}
const nameOf = (id) => props()?.names?.[id] ?? vendor(id).name;

// Reads a status command's answer: Claude's JSON, or the first line of text (Codex: "Logged in using ChatGPT").
function whoFrom(result) {
  const text = `${result?.stdout ?? ""}`.trim() || `${result?.stderr ?? ""}`.trim();
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    return j.loggedIn === false ? { label: "", signedOut: true } : { label: j.email ?? j.account ?? "Signed in", plan: j.subscriptionType ?? "" };
  } catch { /* not JSON: a line of text */ }
  const line = text.split("\n")[0].replace(/\s+-\s+.*$/, ""); // drop a trailing " - sk-…" key hint
  return /not logged in|logged out|no credentials/i.test(line) || result.code !== 0 ? { label: "", signedOut: true } : { label: line };
}

// Who is signed in, per provider, on this computer: where usage-limits measures. Shared by copies.
const auth = { who: {}, at: 0, rev: 0, watchUntil: 0 };
async function loadAuth(ids) {
  for (const id of ids) {
    const { status } = vendor(id);
    if (!status) continue;
    const r = await exec("sh", ["-c", status], { timeout: 15_000 }).catch(() => null);
    const now = r && r.code !== 127 ? whoFrom(r) : null; // 127: the vendor's CLI is not installed
    const before = auth.who[id]?.label;
    auth.who[id] = now;
    // A different account signed in: the limits on show are the old account's, so ask again.
    if (now && before !== undefined && before !== now.label) setShared(REFRESH, Date.now());
  }
  auth.at = Date.now();
  auth.rev++;
}

const left = (sec) => (sec >= 86400 ? `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
  : sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : `${Math.max(0, Math.floor(sec / 60))}m`);

const find = (node, pred) => (!node ? null : pred(node) ? node : (node.children || []).map((c) => find(c, pred)).find(Boolean));

const narrow = () => (find(layout(), (n) => n.id === "sidebar")?.size?.px ?? Infinity) < 160; // the sidebar's rail, as Herdr's own mods tell it

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
        try { await loadAuth(this.providers().map((p) => p.id)); } finally { auth.busy = false; }
      }
      if (this.rev !== auth.rev) { this.rev = auth.rev; cx.notify(); }
    });
  }

  // Opens the vendor's own sign-in in a new tab: on this computer (a new space) or in the shown space.
  signIn(id, here) {
    const { login } = vendor(id), name = `${nameOf(id)} sign-in`;
    if (!login) return;
    const argv = /["'$=;|&]/.test(login) ? ["sh", "-c", login] : login.split(/\s+/);
    if (here) run("space.new", { name, machine: "", argv });
    else run("tab.new", { name, argv });
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
      .child(div().px(8).pb(6).text_color(t.muted).truncate().child(who ? (who.signedOut ? "Not signed in" : who.label) : "…"))
      .child(item("switch", who?.signedOut ? "Sign in…" : "Switch account…", () => this.signIn(id, true)))
      .when(Boolean(remote), (el) => el.child(item("switch-remote", `Switch account on ${remote}…`, () => this.signIn(id, false))))
      .child(div().px(8).pt(8).text_color(t.dim).text_size(11).child(remote
        ? `Usage shown is this computer's account. Agents on ${remote} use the account signed in there.`
        : `Opens ${nameOf(id)}'s sign-in in a new tab.`));
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
    const want = narrow() ? 17 + list.reduce((h, p) => h + 15 * (1 + p.windows.length), 0) + 6 * Math.max(0, list.length - 1) : list.length ? 21 + list.reduce((h, p) => h + 17 + (auth.who[p.id] ? 19 : 0) + 22 * Math.max(1, p.windows.length), 0) + 10 * (list.length - 1) : 44;
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
    // The sidebar folded to its rail: the vendor's initial and each limit's percent, the rest in the tooltip.
    if (narrow()) {
      return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).py(8).gap(6).text_size(10.5)
        .children(list.map((p) => v_flex().id(`account-${p.id}`).items_center().on_click(() => vendor(p.id).login && open(p.id))
          .tooltip(`${nameOf(p.id)}${p.windows.map((w) => `\n${w.long ?? w.short ?? ""} ${Math.round(w.percent)}%${w.resetsAt ? `, resets in ${left(w.resetsAt - now)}` : ""}`).join("")}`)
          .child(div().h(15).font_semibold().text_color(t.foreground).child([...nameOf(p.id)][0] ?? "?"))
          .children(p.windows.map((w) => div().h(15).text_color(tone(w.percent)).child(`${Math.round(w.percent)}%`)))));
    }
    // A vendor we know how to sign in to gets a clickable name; the others a plain one.
    const title = (p) => (vendor(p.id).login
      ? h_flex().id(`account-${p.id}`).gap(5).items_center().rounded(4).hover((s) => s.bg(t.hover)).on_click(() => open(p.id))
        .child(div().text_color(t.foreground).font_semibold().child(nameOf(p.id))).child(div().text_color(t.dim).child("⇄"))
      : div().text_color(t.foreground).font_semibold().child(nameOf(p.id)));
    const rows = list.map((p) => {
      const who = auth.who[p.id];
      return v_flex().gap(4)
        .child(h_flex().justify_between().child(title(p))
          .child(div().text_color(t.dim).child(`${p.plan ?? who?.plan ?? ""}${p.stale && p.windows.length ? " · old" : ""}`)))
        .when(Boolean(who), (el) => el.child(div().h(15).text_color(t.muted).truncate().child(who.signedOut ? "Not signed in" : who.label)))
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
        }));
    });
    return v_flex().size_full().bg(t.chrome).border_t(1).border_color(t.border).px(14).py(10).gap(10).text_size(11.5)
      .children(rows.length ? rows : [div().text_color(t.dim).child("No limits yet (needs the usage-limits mod)")]);
  }
}
