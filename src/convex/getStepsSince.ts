import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    noteId: Id<"notes">,
    version: number
  ): Promise<{ proseMirrorStep: string; clientId: string }[]> =>
    db
      .query("steps")
      .withIndex("by_note_id_and_position", (q) =>
        q.eq("noteId", noteId).gt("position", version)
      )
      .collect()
      .then((steps) =>
        steps.reduce<
          Promise<
            {
              proseMirrorStep: Document<"steps">["proseMirrorStep"];
              clientId: Document<"steps">["clientId"];
            }[]
          >
        >(
          async (resultPromise, step) =>
            resultPromise.then((result) => [
              ...result,
              {
                proseMirrorStep: step.proseMirrorStep,
                clientId: step.clientId,
              },
            ]),
          Promise.resolve([])
        )
      )
);
