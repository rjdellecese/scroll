import type { Eq } from "fp-ts/lib/Eq";
import type { Dispatch } from "react";

// This should _never_ change!
export const getEq = <A>(): Eq<Dispatch<A>> => ({
  equals: () => true,
});
