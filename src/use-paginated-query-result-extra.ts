import type { UsePaginatedQueryResult } from "convex/react";
import type { eq } from "fp-ts";
import { array, string } from "fp-ts";

export const getEq: <A>(eq: eq.Eq<A>) => eq.Eq<UsePaginatedQueryResult<A>> = (
  eq
) => ({
  equals: (x, y) =>
    string.Eq.equals(x.status, y.status) &&
    array.getEq(eq).equals(x.results, y.results),
});
