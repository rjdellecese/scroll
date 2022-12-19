import type { UsePaginatedQueryResult } from "convex/react";
import type { eq } from "fp-ts";
import { array, string } from "fp-ts";

export const getEq: <A>(eqA: eq.Eq<A>) => eq.Eq<UsePaginatedQueryResult<A>> = (
  eqA
) => ({
  equals: (x, y) =>
    string.Eq.equals(x.status, y.status) &&
    array.getEq(eqA).equals(x.results, y.results),
});
