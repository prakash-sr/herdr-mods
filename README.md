# Herdr mods

Two small mods for the [Herdr](https://herdr.dev) desktop app. Each folder holds one mod with its `RECIPE.md`, the brief an agent can rebuild it from.

They are unofficial and not affiliated with Herdr. See also [Machine Pulse](https://github.com/prakash-sr/herdr-machine-pulse), a CPU and memory card for the same sidebar.

## Usage card

Your plan limits as a card that stays in the sidebar, for the account you are signed in to: one row a limit with a bar, the percent used and the time to reset. A click on the account lets you switch to another one.

![Usage card](usage-card/preview.png)

*The card and its switch menu, with sample numbers and a made-up account.*

It is a companion to [usage-limits](https://github.com/nozikov/herdr-usage-limits), which shows the same limits in the status bar and on hover. That mod collects the numbers; this one draws them in a place that is always in view, and adds the account.

What it adds:

- **Always visible.** No hover: 5-hour, weekly and per-model limits for Claude Code, Codex and the other providers usage-limits knows, in the sidebar.
- **Whose limits they are.** The card names the account Claude Code is signed in to (its email, from `claude auth status`), so the numbers are never mistaken for another account's.
- **Switch account from the card.** A click on the account opens a two-line menu. **Switch account…** opens Claude's own sign-in (`claude auth login`) in a new tab. When the space you are in runs on another machine, a second entry does the same there. After you sign in, the card shows the new account and asks usage-limits for fresh numbers.
- **A pace mark on every bar.** The thin line is where the bar would be if you used the limit evenly until it resets, so one look says whether you are ahead of pace.
- **Almost no cost of its own.** The limits come from what usage-limits already publishes in Herdr's shared state. The card itself only runs `claude auth status` every 5 minutes. It makes no request and reads no file.
- **Sizes itself.** The block grows and shrinks with the limits shown.

Good to know: the limits are those of the account signed in **on the computer Herdr runs on**, because that is where usage-limits asks. Switching the account on another machine changes what agents there use, not the numbers shown; the menu says so.

Install (after usage-limits is in your layout):

```sh
git clone https://github.com/prakash-sr/herdr-mods
cp -R herdr-mods/usage-card/mods/usage-card ~/.config/herdr-app/mods/
```

Then add the block to the sidebar column of a layout of your own, for example above the sidebar footer:

```json
{ "id": "usage-card", "type": "block", "size": { "px": 82 }, "content": { "mod": "usage-card" } }
```

With one Claude account there is nothing to set. If you gave usage-limits several (`claudeAccounts`), each gets its own group on the card; tell the card their folders so it can name who is signed in to each, and labels if you like:

```json
"props": { "names": { "claude-work": "Work" }, "configDirs": { "claude-work": "~/.claude-work" } }
```

## Layout toggle

A button that shows or hides one part of your layout: a side panel, a second sidebar, a bar. It is lit while that part is shown.

![Layout toggle](layout-toggle/preview.png)

*"Pull requests" at the right of the tab bar, toggling a panel beside the terminals.*

Herdr's tab bar has buttons for its own Files and Changes panels. A panel another mod adds has no button, only a key if you bind one. This gives it one.

- **Any node.** It runs `layout.toggle` on the id you give it, so it works for any block, row or column.
- **Shows the state.** Lit while the node is shown, muted while hidden.
- **Place it anywhere.** One button a block; put several in a row.

```sh
cp -R herdr-mods/layout-toggle/mods/layout-toggle ~/.config/herdr-app/mods/
```

For a button at the right end of the tab bar, replace the `tabs` block of your own layout with a row:

```json
{ "id": "tabs-row", "type": "row", "size": { "px": 42 }, "resizable": false, "children": [
  { "id": "tabs", "type": "block", "size": { "weight": 1 }, "content": { "mod": "tabs" } },
  { "id": "pr-toggle", "type": "block", "size": { "px": 118 },
    "content": { "mod": "layout-toggle", "props": { "id": "pr-flow", "label": "Pull requests" } } } ] }
```

`id` is the layout node to toggle, `label` the button's text.

## License

MIT
