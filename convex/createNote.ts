import { mutation } from "./_generated/server";

export default mutation(async ({ db }) => {
  const note = await db.table("note").first();
  if (note === null) {
    db.insert("note", {
      doc: '{ "type": "doc", "content": [] }',
    });
    console.log("Created note.");
  } else {
    console.log("Note already exists.");
  }
});
