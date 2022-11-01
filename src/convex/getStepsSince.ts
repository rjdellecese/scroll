import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    docId: Id<"docs">,
    version: number
  ): Promise<{ step: string; clientId: string }[]> => {
    const steps: Document<"steps">[] = await db
      .query("steps")
      // TODO
      // .withIndex("by_doc_id_and_position", (q) =>
      //   q.eq("docId", docId).gt("position", version)
      // )
      .filter((q) =>
        q.and(q.eq(q.field("docId"), docId), q.gt(q.field("position"), version))
      )
      .collect();

    const steps_: Document<"steps">[] = await db
      .query("steps")
      .withIndex("by_doc_id_and_position", (q) =>
        q.eq("docId", docId).gt("position", version)
      )
      // TODO
      // .filter((q) =>
      //   q.and(q.eq(q.field("docId"), docId), q.gt(q.field("position"), version))
      // )
      .collect();

    console.log("docId", docId);
    console.log(
      "steps docIds",
      steps.map((step) => step.docId)
    );
    console.log(
      "steps_ docIds",
      steps_.map((step) => step.docId)
    );

    return await steps.reduce<
      Promise<
        {
          step: Document<"steps">["step"];
          clientId: Document<"steps">["clientId"];
        }[]
      >
    >(async (resultPromise, step) => {
      return resultPromise.then((result) => [
        ...result,
        {
          step: step.step,
          clientId: step.clientId,
        },
      ]);
    }, Promise.resolve([]));
  }
);
