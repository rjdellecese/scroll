import type { GenericDocument } from "convex/server";
import type { GenericId } from "convex/values";
import { number } from "fp-ts";
import type { Eq } from "fp-ts/lib/Eq";
import type { Ord } from "fp-ts/lib/Ord";

export type TimestampedId<TableName extends string> = {
  _id: GenericId<TableName>;
  _creationTime: number;
};

// TYPECLASS INSTANCES

export const URI = "TimestampedId";

export type URI = typeof URI;

// TYPECLASS INSTANCES

export const getEq = <TableName extends string>(): Eq<
  TimestampedId<TableName>
> => ({
  equals: (x, y) => x._id.equals(y._id),
});

export const getOrd = <TableName extends string>(): Ord<
  TimestampedId<TableName>
> => ({
  equals: getEq<TableName>().equals,
  compare: (first, second) =>
    number.Ord.compare(first._creationTime, second._creationTime),
});

// CONSTRUCTORS

export const fromDocument = <TableName extends string>(
  document: {
    _id: GenericId<TableName>;
    _creationTime: number;
  } & GenericDocument
): TimestampedId<TableName> => ({
  _id: document._id,
  _creationTime: document._creationTime,
});
