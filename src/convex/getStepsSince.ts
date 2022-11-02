import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    noteId: Id<"notes">,
    version: number
  ): Promise<{ step: string; clientId: string }[]> =>
    db
      .query("steps")
      // TODO: Awaiting bug fix
      // .withIndex("by_note_id_and_position", (q) =>
      //   q.eq("noteId", noteId).gt("position", version)
      // )
      .filter((q) =>
        q.and(
          q.eq(q.field("noteId"), noteId),
          q.gt(q.field("position"), version)
        )
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
