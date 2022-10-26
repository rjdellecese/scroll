import type { GenericAPI, NamedQuery, QueryNames } from "convex/browser";
import { convexToJson } from "convex/values";
import type * as E from "fp-ts/lib/Eq";
import type { Newtype } from "newtype-ts";
import { iso } from "newtype-ts";

export const URI = "UniqueQuery";

export interface UniqueQuery<API extends GenericAPI>
  extends Newtype<
    { readonly UniqueQuery: unique symbol },
    { name: string; args: string }
  > {}

const isoUniqueQuery = <API extends GenericAPI>() => iso<UniqueQuery<API>>();

// TYPECLASS INSTANCES

// TODO: Test this
export const getEq: <API extends GenericAPI>() => E.Eq<
  UniqueQuery<API>
> = () => ({
  equals: (first, second) => {
    const firstUnwrapped = isoUniqueQuery().unwrap(first);
    const secondUnwrapped = isoUniqueQuery().unwrap(second);

    return (
      firstUnwrapped.name === secondUnwrapped.name &&
      secondUnwrapped.args === secondUnwrapped.args
    );
  },
});

// CONSTRUCTORS

export const fromNameAndArgs = <
  API extends GenericAPI,
  Name extends QueryNames<API>
>(
  name: Name,
  args: Parameters<NamedQuery<API, Name>>
): UniqueQuery<API> =>
  isoUniqueQuery().wrap({ name, args: JSON.stringify(convexToJson(args)) });
