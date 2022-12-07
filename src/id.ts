import { string } from "fp-ts";
import type { Eq } from "fp-ts/Eq";
import type { Ord } from "fp-ts/lib/Ord";

import type { Id, TableNames } from "~src/convex/_generated/dataModel";

// TYPECLASS INSTANCES

export const getEq = <TableName extends TableNames>(): Eq<Id<TableName>> => ({
  equals: (x, y) => x.equals(y),
});

export const getOrd = <TableName extends TableNames>(): Ord<Id<TableName>> => ({
  equals: getEq<TableName>().equals,
  compare: (first, second) =>
    string.Ord.compare(first.toString(), second.toString()),
});
