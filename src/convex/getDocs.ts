import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getVersion from "./getVersion";
import type { TimestampedId } from "../timestamped-id";
import * as timestampedId from "../timestamped-id";

export default query(
  async ({
    db,
  }): Promise<
    Map<
      TimestampedId<"docs">,
      { doc: Document<"docs">["doc"]; version: number }
    >
  > =>
    db
      .query("docs")
      .take(10)
      .then((docs) =>
        docs.reduce(
          async (resultPromise, doc) =>
            resultPromise.then((result) =>
              getVersion(db, doc._id).then((version) =>
                result.set(timestampedId.fromDocument(doc), {
                  doc: doc.doc,
                  version,
                })
              )
            ),
          Promise.resolve(
            new Map<
              TimestampedId<"docs">,
              { doc: Document<"docs">["doc"]; version: number }
            >()
          )
        )
      )
);
