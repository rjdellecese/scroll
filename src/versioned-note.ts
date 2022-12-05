import type { eq } from "fp-ts";

import type { Document } from "./convex/_generated/dataModel";

export type VersionedNote = Document<"notes"> & { version: number };

export const Eq: eq.Eq<VersionedNote> = {
  equals: (x, y) => x === y,
};
