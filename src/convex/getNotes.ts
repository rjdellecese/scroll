import type { PaginationOptions, PaginationResult } from "convex/server";

import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db, auth },
    opts: PaginationOptions
  ): Promise<PaginationResult<Id<"notes">>> =>
    auth.getUserIdentity().then(async (userIdentity) => {
      if (userIdentity) {
        return db
          .query("notes")
          .order("desc")
          .filter((q) => q.eq(q.field("owner"), userIdentity.tokenIdentifier))
          .paginate(opts)
          .then((notesPaginationResult) => ({
            page: notesPaginationResult.page.map((note) => note._id),
            isDone: notesPaginationResult.isDone,
            continueCursor: notesPaginationResult.continueCursor,
          }));
      } else {
        throw "Not authenticated";
      }
    })
);
