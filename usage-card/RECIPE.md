# Usage card

Plan limits that stay in view, for the account you are signed in to. A sidebar card with one row a limit: a bar, the percent used, the time to reset, and a pace mark that shows whether you are burning faster than an even pace. Where a status bar item needs a hover, this is always on screen. It names who is signed in to Claude Code, Codex or any other vendor, and a click on the vendor switches account by opening its own sign-in in a new tab. It draws what the usage-limits mod collects, so it calls no usage API itself.

![Usage card](preview.png)

## What you see

A sidebar block on the `chrome` background with a 1 px top border, 14 px side padding, 10 px above and below, text 11.5 px. One group per provider, 10 px apart:

- A title row: the provider's name in `foreground`, semibold, on the left; its plan (`max`, `plus`) in `dim` on the right, with ` · old` when the last report failed and an earlier one is shown. A vendor the card can sign in to has `⇄` after its name and takes the `hover` background under the pointer.
- Under the title, when the vendor says who is signed in, a 15 px line in `muted`: the email (Claude Code), the vendor's own status line (Codex: `Logged in using ChatGPT`), or `Not signed in`.
- One row per limit, 18 px high: the limit's short name (`5h`, `wk`, `Opus`) in `dim`, 44 px wide; a 96 px by 5 px rounded track in `border`, filled to the percent used; the percent in `foreground`; the time to reset in `dim` (`2h 14m`, `3d 4h`).
- Fill color: `ansi2` (green) below 75%, `ansi3` (yellow) from 75%, `ansi1` (red) from 90%.
- A pace mark on each track: a 1 px by 9 px line in `muted` at the share of the limit's window that has passed.
- A Claude account with no limits shows one `dim` line with the reason usage-limits reported.

**Switch menu** (a dialog 280 px wide, `popover` background, text 12.5 px): the vendor's name with the plan in `dim`; who is signed in, in `muted`; the entry `Switch account…` (`Sign in…` when nobody is signed in); when the shown space is on another machine, a second entry `Switch account on <machine>…`; then one `dim` line of 11 px saying what the entries do.

## How it behaves

- It redraws when usage-limits publishes new numbers, and once a minute so the time to reset moves on.
- Every 5 minutes it asks each shown vendor who is signed in, with that vendor's status command, on this computer.
- A click on a vendor opens the menu. `Switch account…` opens a new space on this computer running the vendor's sign-in command. `Switch account on <machine>…` opens a new tab in the shown space running the same. The person finishes the sign-in themselves.
- For 5 minutes after a switch was opened, it asks who is signed in every 5 seconds. When the answer changes it sets shared `usage-limits.refresh`, so usage-limits fetches the new account's limits.
- A vendor without a status command has no line; one without a sign-in command has a plain name and no menu.
- Other providers (Codex, OpenCode Go, Antigravity) are shown when they have limits.
- A provider usage-limits has stopped reporting (11 minutes behind the newest report) is left out.
- The block sets its own height from the rows shown.
- Opened by itself (`mod.open`), it shows the menu.
- Without usage-limits, or before its first report, it says `No limits yet (needs the usage-limits mod)`.

## Built from

- One mod, `mods/usage-card/`: `main.js` and `mod.json` (`{ "place": "none", "overlay": { "width": 280, "height": 176 } }`).
- A table of vendors, by usage-limits' provider id: `claude` (`claude auth status --json`, `claude auth login`), `codex` (`codex login status`, `codex login`), `opencode-go` (`opencode auth login`, no status), `agy` (name only). A status command prints JSON (`loggedIn`, `email`, `subscriptionType`) or text, whose first line is shown; exit code 127 means the CLI is missing; a line saying not logged in, or a non-zero exit, means signed out; anything after ` - ` on a text line is dropped, since some CLIs print a key hint there.
- Props, all optional: `{ "names": { "<id>": "Label" }, "configDirs": { "<claude id>": "~/.claude-work" }, "vendors": { "<id>": { "name", "status", "login" } } }`. `vendors` adds a vendor or replaces a built-in one's commands. The account `claude` uses Claude Code's default folder; another Claude account gets its commands only when `configDirs` names its folder, run with `CLAUDE_CONFIG_DIR` set. `{ "view": "menu", "account": "<id>" }` is the menu.
- From `herdr`: `exec`, `shared`, `setShared`, `layout`, `spaces`, `openOverlay`, `closeOverlay`, `run` (`layout.resize`, `space.new`, `tab.new`), `props`, `theme`, `checking`.
- Reads shared `usage-limits.state`: an object of providers, each `{ report, lastGood }`, a report being `{ status, plan, message, observedAt, windows: [{ short, percent, resetsAt, durationSec }] }`. Claude accounts are the ids `claude` and `claude-<suffix>`.
- Writes shared `usage-limits.refresh` (now, in ms) when the signed-in email changes.
- Who is signed in is module-level state shared by copies: per provider `{ label, plan }` or `{ signedOut }`.
- `test.mjs` runs the lookup for Claude, a second Claude folder, Codex and a vendor added by props, then the menu and the switch entries, with the app's functions faked.

## Watch out

- It depends on the shape of another mod's shared state. If usage-limits changes it, the card shows nothing or the wrong rows.
- usage-limits must be in the shown layout, or nothing is collected.
- The limits are measured where Herdr runs. Switching the account on another machine changes what agents there use, not the numbers; the menu says so.
- The only programs it runs by itself are the vendors' status commands. It never signs anyone in or out: the switch is the vendor's own command in a terminal the person sees. Never add limit polling here.
- Never read a vendor's credential file to find an email; show what its status command prints, or nothing.
- A sign-in command with quotes, `$`, `=` or pipes runs through `sh -c`; a plain one is split on spaces.
- Keep the menu to the one account that was clicked. A list of every account with two entries each was tried and read as a wall of choices.
- Open the menu as a dialog: the card sits low in the sidebar, where a popup at the pointer would be cut off.
- Don't guess the folder of an extra account: without `configDirs` its email line is left out.
- A CLI that is missing or too old for its status command gives no line; the card still works.
- Codex's commands were written from its CLI's documented `login` and `login status`; check them on a machine that has Codex.
- Don't call `layout.resize` on every render: only when the wanted height changed.

## Done when

- `herdr-app check mods/usage-card` passes and `node test.mjs` prints `ok`.
- With usage-limits in the layout, the card shows each limit with a bar, a percent and a time to reset, the email of the signed-in account under its name, and the block is as tall as its rows.
- A click on Claude opens the menu; `Switch account…` opens a tab running `claude auth login`, and after signing in as someone else the card shows the new email and new limits within a few seconds.
- With Codex installed, its group shows its status line and its menu opens `codex login`.
- A vendor added through `vendors` shows its line and gets a menu.
- `herdr-app status` lists no errors.
