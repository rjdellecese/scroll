import type { eq } from "fp-ts";

import type { Doc } from "~src/convex/_generated/dataModel";

export type VersionedNote = Omit<Doc<"notes">, "proseMirrorDoc"> & {
  proseMirrorDoc: string;
  version: number;
};

export const Eq: eq.Eq<VersionedNote> = {
  equals: (x, y) => x === y,
};
