import { EditorState } from "prosemirror-state";

import { schema } from "../tiptap-schema-extensions";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export default mutation(async ({ db }): Promise<Id<"docs">> => {
  const doc = JSON.stringify(EditorState.create({ schema }).doc.toJSON());
  return await db.insert("docs", {
    doc: doc,
  });
});
