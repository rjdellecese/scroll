import type {
  DataModelFromSchemaDefinition,
  DocumentMapFromSchemaDefinition,
} from "convex/schema";
import type { TableNamesInDataModel } from "convex/server";
import type { GenericId } from "convex/values";
import { number } from "fp-ts";
import type { Eq } from "fp-ts/lib/Eq";
import type { Ord } from "fp-ts/lib/Ord";

import type schema from "./convex/schema";

// TODO: This is funky!
type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type TableNames = TableNamesInDataModel<DataModel>;
type Document<TableName extends TableNames> = DocumentMapFromSchemaDefinition<
  typeof schema
>[TableName];
type Id<TableName extends TableNames> = GenericId<TableName>;

export type TimestampedId<TableName extends TableNames> = {
  _id: Id<TableName>;
  _creationTime: number;
};

// TYPECLASS INSTANCES

export const URI = "TimestampedId";

export type URI = typeof URI;

// TYPECLASS INSTANCES

export const getEq = <TableName extends TableNames>(): Eq<
  TimestampedId<TableName>
> => ({
  equals: (x, y) => x._id.equals(y._id),
});

export const getOrd = <TableName extends TableNames>(): Ord<
  TimestampedId<TableName>
> => ({
  equals: getEq<TableName>().equals,
  compare: (first, second) =>
    number.Ord.compare(first._creationTime, second._creationTime),
});

// CONSTRUCTORS

export const fromDocument = <TableName extends TableNames>(
  document: Document<TableName>
): TimestampedId<TableName> => ({
  _id: document._id,
  _creationTime: document._creationTime as number,
});
