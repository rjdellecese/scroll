import type { eq } from "fp-ts";
import { string } from "fp-ts";
import type { Newtype } from "newtype-ts";
import { iso } from "newtype-ts";

export interface HtmlId
  extends Newtype<{ readonly HtmlId: unique symbol }, string> {}

const isoHtmlId = iso<HtmlId>();

export const toString = isoHtmlId.unwrap;

// TYPECLASS INSTANCES

export const Eq: eq.Eq<HtmlId> = {
  equals: (x, y) => string.Eq.equals(isoHtmlId.unwrap(x), isoHtmlId.unwrap(y)),
};

// HTML IDS

export const footer = isoHtmlId.wrap("footer");
