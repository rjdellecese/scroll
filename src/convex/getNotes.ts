import type { Id } from "~src/convex/_generated/dataModel";
import { query } from "~src/convex/_generated/server";
import type { DatePaginationCursors } from "~src/date-pagination-cursors";

export default query(
  async (
    { db, auth },
    {
      datePaginationCursors,
    }: { datePaginationCursors: DatePaginationCursors | null },
  ): Promise<Id<"notes">[]> =>
    auth.getUserIdentity().then(async (userIdentity) => {
      if (userIdentity) {
        if (datePaginationCursors) {
          if (
            datePaginationCursors.largerDateCursor <
            datePaginationCursors.smallerDateCursor
          )
            throw "`largerDateCursor` is smaller than `smallerDateCursor`";

          const inBetween = await db
            .query("notes")
            .order("desc")
            .filter((q) =>
              q.and(
                q.eq(q.field("owner"), userIdentity.tokenIdentifier),
                q.gte(
                  q.field("_creationTime"),
                  datePaginationCursors.smallerDateCursor,
                ),
                q.lte(
                  q.field("_creationTime"),
                  datePaginationCursors.largerDateCursor,
                ),
              ),
            )
            .collect()
            .then((notes) => notes.map(({ _id }) => _id));

          const lessThanSmaller = await db
            .query("notes")
            .order("desc")
            .filter((q) =>
              q.and(
                q.eq(q.field("owner"), userIdentity.tokenIdentifier),
                q.lt(
                  q.field("_creationTime"),
                  datePaginationCursors.smallerDateCursor,
                ),
              ),
            )
            .take(10)
            .then((notes) => notes.map(({ _id }) => _id));

          const greaterThanLarger = await db
            .query("notes")
            .order("asc")
            .filter((q) =>
              q.and(
                q.eq(q.field("owner"), userIdentity.tokenIdentifier),
                q.gt(
                  q.field("_creationTime"),
                  datePaginationCursors.largerDateCursor,
                ),
              ),
            )
            .take(10)
            .then((notes) => notes.map(({ _id }) => _id).reverse());

          return [...greaterThanLarger, ...inBetween, ...lessThanSmaller];
        } else {
          return await db
            .query("notes")
            .order("desc")
            .filter((q) => q.eq(q.field("owner"), userIdentity.tokenIdentifier))
            .take(20)
            .then((notes) => notes.map(({ _id }) => _id));
        }
      } else {
        throw "Not authenticated";
      }
    }),
);
