import { VNode } from "preact";
import { createPortal } from "preact/compat";

export const PreactPortal = (props: { children: VNode<{}> }) => {
  return createPortal(props.children, document.body);
};
