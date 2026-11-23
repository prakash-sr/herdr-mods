import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { layout, props, run, theme } from "herdr";

// A button that shows or hides one layout node: props { id, label }. Lit while the node is shown.
const find = (node, id) => (node?.id === id ? node : (node?.children || []).map((c) => find(c, id)).find(Boolean));

export default class LayoutToggle extends View {
  render() {
    const t = theme(), { id, label } = props() || {};
    const shown = find(layout(), id)?.hidden !== true;
    return h_flex().size_full().items_center().justify_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(div().id("toggle").px(8).py(3).rounded(5).text_size(12.5).text_color(shown ? t.foreground : t.muted)
        .when(shown, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
        .on_click(() => run("layout.toggle", { id })).child(label ?? id ?? "Toggle"));
  }
}
