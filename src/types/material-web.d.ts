import type { HTMLAttributes, ReactNode, Ref } from "react";

type WebAttrs = HTMLAttributes<HTMLElement> & {
  ref?: Ref<HTMLElement>;
  class?: string;
  disabled?: boolean;
  selected?: boolean;
  icons?: boolean;
  type?: string;
  children?: ReactNode;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "md-switch": WebAttrs;
      "md-filled-button": WebAttrs;
      "md-outlined-button": WebAttrs;
      "md-text-button": WebAttrs;
      "md-icon-button": WebAttrs;
    }
  }
}

export {};
