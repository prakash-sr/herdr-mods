# Layout toggle

A button that shows or hides one node of the layout, lit while that node is shown. Put it in the tab bar's row to give another mod's side panel a button like Herdr's own Files and Changes.

![Layout toggle](preview.png)

## What you see

A block on the `chrome` background with a 1 px bottom border, its content centered: one button, 8 px side padding, 3 px above and below, 5 px corners, text 12.5 px. Shown node: label in `foreground` on a `selected` background. Hidden node: label in `muted`, no background. Under the pointer the button takes the `hover` background.

## How it behaves

- A click runs `layout.toggle` on the node. The button redraws when the layout changes, so it also follows a key or another mod toggling the same node.
- A node id the layout doesn't have counts as shown; the click does nothing.

## Built from

- One mod, `mods/layout-toggle/`: `main.js` (about 15 lines) and `mod.json` (`{ "place": "none" }`).
- Props: `{ "id": "<layout node id>", "label": "<button text>" }`. Without a label the id is shown.
- From `herdr`: `layout`, `props`, `run` (`layout.toggle`), `theme`.

## Watch out

- The block needs a fixed width that fits the label (about 118 px for "Pull requests").
- In a tab bar row, keep the `tabs` block at `"size": { "weight": 1 }` so it takes the rest.
- A hidden mod block that was never shown has not started; its mod begins when the button first shows it.
- The bottom border matches Herdr's tab bar. In another place, change or drop it.

## Done when

- `herdr-app check mods/layout-toggle` passes.
- The button hides the node it names and shows it again, and is lit only while the node is shown.
- Toggling the node with a key changes the button too.
