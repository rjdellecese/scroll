import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    docId: Id<"docs">,
    version: number
  ): Promise<{ step: string; clientId: string }[]> =>
    db
      .query("steps")
      // TODO: Awaiting bug fix
      // .withIndex("by_doc_id_and_position", (q) =>
      //   q.eq("docId", docId).gt("position", version)
      // )
      .filter((q) =>
        q.and(q.eq(q.field("docId"), docId), q.gt(q.field("position"), version))
      )
      .collect()
      .then((steps) =>
        steps.reduce<
          Promise<
            {
              step: Document<"steps">["step"];
              clientId: Document<"steps">["clientId"];
            }[]
          >
        >(
          async (resultPromise, step) =>
            resultPromise.then((result) => [
              ...result,
              {
                step: step.step,
                clientId: step.clientId,
              },
            ]),
          Promise.resolve([])
        )
      )
);
