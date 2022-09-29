import { mutation } from "./_generated/server";

export default mutation(async ({ db }) => {
  const note = await db.table("notes").first();
  if (note === null) {
    db.insert("notes", {
      doc: '{ "type": "doc", "content": [] }',
      steps: [],
      stepClientIds: [],
    });
    console.log("Created note.");
  } else {
    console.log("Note already exists.");
  }
});
