import type { Doc, Id } from "~src/convex/_generated/dataModel";
import { query } from "~src/convex/_generated/server";

export default query(
  async (
    { db, auth },
    { noteId, version }: { noteId: Id<"notes">; version: number },
  ): Promise<{ proseMirrorStep: string; clientId: string }[]> =>
    auth.getUserIdentity().then((userIdentity) =>
      userIdentity
        ? db
            .query("steps")
            .withIndex("by_note_id_and_position", (q) =>
              q.eq("noteId", noteId).gt("position", version),
            )
            .collect()
            .then((steps) =>
              steps.reduce<
                Promise<
                  {
                    proseMirrorStep: Doc<"steps">["proseMirrorStep"];
                    clientId: Doc<"steps">["clientId"];
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
                Promise.resolve([]),
              ),
            )
        : Promise.reject(),
    ),
);
