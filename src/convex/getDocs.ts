import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getVersion from "./getVersion";

export default query(
  async ({
    db,
  }): Promise<
    Map<Id<"docs">, { doc: Document<"docs">["doc"]; version: number }>
  > =>
    db
      .query("docs")
      .take(10)
      .then((docs) =>
        docs.reduce(
          async (resultPromise, doc) =>
            resultPromise.then((result) =>
              getVersion(db, doc._id).then((version) =>
                result.set(doc._id, {
                  doc: doc.doc,
                  version,
                })
              )
            ),
          Promise.resolve(
            new Map<
              Id<"docs">,
              { doc: Document<"docs">["doc"]; version: number }
            >()
          )
        )
      )
);
