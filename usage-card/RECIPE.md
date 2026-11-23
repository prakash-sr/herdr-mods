# Usage card

Plan limits as a card that stays in the sidebar, for the account that is signed in: one row a limit with a bar, the percent used and the time to reset. It draws what the usage-limits mod collects, names the account, and opens Claude's sign-in to switch to another.

![Usage card](preview.png)

## What you see

A sidebar block on the `chrome` background with a 1 px top border, 14 px side padding, 10 px above and below, text 11.5 px. One group per provider, 10 px apart:

- A title row: the provider's name in `foreground`, semibold, on the left; its plan (`max`, `plus`) in `dim` on the right, with ` · old` when the last report failed and an earlier one is shown. A Claude account's name is followed by `⇄` and takes the `hover` background under the pointer.
- Under a Claude account's title, a 15 px line in `muted`: the email it is signed in with, or `Not signed in`.
- One row per limit, 18 px high: the limit's short name (`5h`, `wk`, `Opus`) in `dim`, 44 px wide; a 96 px by 5 px rounded track in `border`, filled to the percent used; the percent in `foreground`; the time to reset in `dim` (`2h 14m`, `3d 4h`).
- Fill color: `ansi2` (green) below 75%, `ansi3` (yellow) from 75%, `ansi1` (red) from 90%.
- A pace mark on each track: a 1 px by 9 px line in `muted` at the share of the limit's window that has passed.
- A Claude account with no limits shows one `dim` line with the reason usage-limits reported.

**Switch menu** (a dialog 280 px wide, `popover` background, text 12.5 px): the account's name with its plan in `dim`; its email in `muted`; the entry `Switch account…` (`Sign in…` when nobody is signed in); when the shown space is on another machine, a second entry `Switch account on <machine>…`; then one `dim` line of 11 px saying what the entries do.

## How it behaves

- It redraws when usage-limits publishes new numbers, and once a minute so the time to reset moves on.
- Every 5 minutes it asks who is signed in: `claude auth status --json` on this computer.
- A click on a Claude account opens the menu. `Switch account…` opens a new space on this computer running `claude auth login`. `Switch account on <machine>…` opens a new tab in the shown space running the same. The person finishes the sign-in in their browser.
- For 5 minutes after a switch was opened, it asks who is signed in every 5 seconds. When the email changes it sets shared `usage-limits.refresh`, so usage-limits fetches the new account's limits.
- Other providers (Codex, OpenCode Go, Antigravity) are shown when they have limits.
- A provider usage-limits has stopped reporting (11 minutes behind the newest report) is left out.
- The block sets its own height from the rows shown.
- Opened by itself (`mod.open`), it shows the menu.
- Without usage-limits, or before its first report, it says `No limits yet (needs the usage-limits mod)`.

## Built from

- One mod, `mods/usage-card/`: `main.js` and `mod.json` (`{ "place": "none", "overlay": { "width": 280, "height": 176 } }`).
- Props, all optional: `{ "names": { "<provider id>": "Label" }, "configDirs": { "<provider id>": "~/.claude-work" } }`. The account `claude` uses Claude Code's default folder. Another account is asked only when `configDirs` names its folder, with `CLAUDE_CONFIG_DIR` set. `{ "view": "menu", "account": "<id>" }` is the menu.
- From `herdr`: `exec`, `shared`, `setShared`, `layout`, `spaces`, `openOverlay`, `closeOverlay`, `run` (`layout.resize`, `space.new`, `tab.new`), `props`, `theme`, `checking`.
- Reads shared `usage-limits.state`: an object of providers, each `{ report, lastGood }`, a report being `{ status, plan, message, observedAt, windows: [{ short, percent, resetsAt, durationSec }] }`. Claude accounts are the ids `claude` and `claude-<suffix>`.
- Writes shared `usage-limits.refresh` (now, in ms) when the signed-in email changes.
- Who is signed in is module-level state shared by copies: per account `{ email, org, plan }` or `{ signedOut }`.
- `test.mjs` runs the account lookup, the menu and the switch entries with the app's functions faked.

## Watch out

- It depends on the shape of another mod's shared state. If usage-limits changes it, the card shows nothing or the wrong rows.
- usage-limits must be in the shown layout, or nothing is collected.
- The limits are measured where Herdr runs. Switching the account on another machine changes what agents there use, not the numbers; the menu says so.
- The only program it runs by itself is `claude auth status`. It never signs anyone in or out: the switch is Claude's own command in a terminal the person sees. Never add limit polling here.
- Keep the menu to the one account that was clicked. A list of every account with two entries each was tried and read as a wall of choices.
- Open the menu as a dialog: the card sits low in the sidebar, where a popup at the pointer would be cut off.
- Don't guess the folder of an extra account: without `configDirs` its email line is left out.
- An old `claude` without `auth status --json` gives no email line; the card still works.
- Don't call `layout.resize` on every render: only when the wanted height changed.

## Done when

- `herdr-app check mods/usage-card` passes and `node test.mjs` prints `ok`.
- With usage-limits in the layout, the card shows each limit with a bar, a percent and a time to reset, the email of the signed-in account under its name, and the block is as tall as its rows.
- A click on the account opens the menu; `Switch account…` opens a tab running `claude auth login`, and after signing in as someone else the card shows the new email and new limits within a few seconds.
- `herdr-app status` lists no errors.
