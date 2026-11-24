# Herdr mods

Two small mods for the [Herdr](https://herdr.dev) desktop app. Each folder holds one mod with its `RECIPE.md`, the brief an agent can rebuild it from.

They are unofficial and not affiliated with Herdr. See also [Machine Pulse](https://github.com/prakash-sr/herdr-machine-pulse), a CPU and memory card for the same sidebar.

## Usage card

Your plan limits as a card that stays in the sidebar, for the account you are signed in to: one row a limit with a bar, the percent used and the time to reset. A click on a vendor lets you switch account.

![Usage card](usage-card/preview.png)

*The card and its switch menu, with sample numbers and a made-up account.*

It is a companion to [usage-limits](https://github.com/nozikov/herdr-usage-limits), which shows the same limits in the status bar and on hover. That mod collects the numbers; this one draws them in a place that is always in view, and adds the account.

What it adds:

- **Always visible.** No hover: 5-hour, weekly and per-model limits for Claude Code, Codex and the other providers usage-limits knows, in the sidebar.
- **Whose limits they are.** Under each vendor the card says who is signed in: the email for Claude Code, the vendor's own status line for Codex.
- **Switch account from the card, for any vendor.** A click on the vendor opens a two-line menu. **Switch account…** opens the vendor's own sign-in in a new tab (`claude auth login`, `codex login`, `opencode auth login`). When the space you are in runs on another machine, a second entry does the same there. After you sign in, the card shows the new account and asks usage-limits for fresh numbers.
- **Add your own vendor.** Tell the card a status command and a sign-in command and any CLI gets the same line and menu.
- **A pace mark on every bar.** The thin line is where the bar would be if you used the limit evenly until it resets, so one look says whether you are ahead of pace.
- **Almost no cost of its own.** The limits come from what usage-limits already publishes in Herdr's shared state. The card itself only runs each vendor's status command every 5 minutes. It makes no request and reads no credential file.
- **Sizes itself.** The block grows and shrinks with the limits shown.

Good to know: the limits are those of the account signed in **on the computer Herdr runs on**, because that is where usage-limits asks. Switching the account on another machine changes what agents there use, not the numbers shown; the menu says so. The Codex commands are the ones its CLI documents; they were not tried on a machine with Codex.

Install (after usage-limits is in your layout):

```sh
git clone https://github.com/prakash-sr/herdr-mods
cp -R herdr-mods/usage-card/mods/usage-card ~/.config/herdr-app/mods/
```

Then add the block to the sidebar column of a layout of your own, for example above the sidebar footer:

```json
{ "id": "usage-card", "type": "block", "size": { "px": 82 }, "content": { "mod": "usage-card" } }
```

With one account per vendor there is nothing to set. Optional props:

```json
"props": {
  "names": { "claude-work": "Work" },
  "configDirs": { "claude-work": "~/.claude-work" },
  "vendors": { "mytool": { "name": "My Tool", "status": "mytool whoami", "login": "mytool login" } }
}
```

- `names`: your labels, by usage-limits' provider id.
- `configDirs`: the folder of each extra Claude account you gave usage-limits (`claudeAccounts`), so the card can say who is signed in to it.
- `vendors`: add a vendor, or replace a built-in one's commands. `status` prints who is signed in (JSON with `email`, or a line of text); `login` signs in.

## Layout toggle

Buttons that show or hide any part of your layout: a side panel, a sidebar, a card, a bar. Each is lit while its part is shown. You pick the parts from a list; there is no file to edit.

![Layout toggle](layout-toggle/preview.png)

*The settings, and "Pull requests" at the right of the tab bar with the `+` that opens them.*

Herdr's tab bar has buttons for its own Files and Changes panels. A panel another mod adds has no button, only a key if you bind one. This gives it one.

- **Pick from a list.** The `+` at the end of the buttons opens the settings: every part of the layout is listed with what it holds and whether it is hidden. A click adds a button for it.
- **Rename and remove.** Click a button's name in the settings to rename it; the `✕` removes it.
- **Shows the state.** Lit while the part is shown, muted while hidden, also when a key or another mod toggled it.
- **Any part.** It runs Herdr's `layout.toggle` on the part's id, so it works for a block, a row or a column.
- **Fits itself.** The block is as wide as its buttons.

```sh
git clone https://github.com/prakash-sr/herdr-mods
cp -R herdr-mods/layout-toggle/mods/layout-toggle ~/.config/herdr-app/mods/
herdr-app do mod.open --name layout-toggle
```

The last line opens the settings. **Add the buttons to the tab bar** puts the block at the right end of the tab bar's row, then pick the parts you want buttons for. Herdr's own layouts are read-only, so do this on a layout of your own (`herdr-app do layout.clone '{"name":"main","as":"mine"}'`).

To place the block yourself, anywhere in a layout:

```json
{ "id": "layout-toggle", "type": "block", "size": { "px": 60 }, "content": { "mod": "layout-toggle" } }
```

## License

MIT
