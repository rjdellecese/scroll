import { EditorState } from "prosemirror-state";

import { schema } from "../tiptap-schema-extensions";
import { mutation } from "./_generated/server";

export default mutation(async ({ db }): Promise<void> => {
  const proseMirrorDoc = JSON.stringify(
    EditorState.create({ schema }).doc.toJSON()
  );
  await db.insert("notes", {
    proseMirrorDoc,
  });
});
