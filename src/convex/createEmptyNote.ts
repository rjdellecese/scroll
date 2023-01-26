import { EditorState } from "prosemirror-state";

import { mutation } from "~src/convex/_generated/server";
import { schema } from "~src/tiptap-schema-extensions";

export default mutation(async ({ db, auth }): Promise<void> => {
  const userIdentity = await auth.getUserIdentity();

  if (userIdentity) {
    const proseMirrorDoc = JSON.stringify(
      EditorState.create({ schema }).doc.toJSON()
    );

    await db.insert("notes", {
      proseMirrorDoc,
      owner: userIdentity.tokenIdentifier,
    });
  } else {
    throw "You must be logged in to create a note!";
  }
});
