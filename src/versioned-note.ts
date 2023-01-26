import type { eq } from "fp-ts";

import type { Document } from "~src/convex/_generated/dataModel";

export type VersionedNote = Omit<Document<"notes">, "proseMirrorDoc"> & {
  proseMirrorDoc: string;
  version: number;
};

export const Eq: eq.Eq<VersionedNote> = {
  equals: (x, y) => x === y,
};
