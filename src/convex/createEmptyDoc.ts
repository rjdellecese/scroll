import { EditorState } from "prosemirror-state";

import { schema } from "../tiptap-schema-extensions";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

export default mutation(
  async ({ db }): Promise<{ id: Id<"docs">; doc: string; version: number }> => {
    const doc = JSON.stringify(EditorState.create({ schema }).doc.toJSON());
    const id = await db.insert("docs", {
      doc: doc,
    });
    return { id, doc, version: 0 };
  }
);
