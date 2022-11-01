import { EditorState } from "prosemirror-state";

import { schema } from "../tiptap-schema-extensions";
import type { Document } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export default mutation(async ({ db }): Promise<Document<"docs">> => {
  const doc = JSON.stringify(EditorState.create({ schema }).doc.toJSON());
  const id = await db.insert("docs", {
    doc: doc,
  });
  const doc_ = await db.get(id);
  if (doc_) {
    return doc_;
  } else {
    throw "Inserted doc not found!";
  }
});
