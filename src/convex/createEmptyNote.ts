import { EditorState } from "prosemirror-state";

import { schema } from "../tiptap-schema-extensions";
import { mutation } from "./_generated/server";

export default mutation(async ({ db, auth }): Promise<void> => {
  const userIdentity = await auth.getUserIdentity();

  if (userIdentity) {
    const proseMirrorDoc = EditorState.create({ schema }).doc.toJSON();

    await db.insert("notes", {
      proseMirrorDoc,
      owner: userIdentity.tokenIdentifier,
    });
  } else {
    throw "You must be logged in to create a note!";
  }
});
