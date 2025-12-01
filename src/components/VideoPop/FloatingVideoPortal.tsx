import { VNode } from "preact";
import { createPortal } from "preact/compat";

export const FloatingVideoPortal = (props: { children: VNode<{}> }) => {
  return createPortal(props.children, document.body);
};
