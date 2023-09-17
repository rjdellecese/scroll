# Scroll

[📜 scroll.ink](https://scroll.ink)

Scroll is a prototype of an infinite-scrolling note-taking app, built on [Convex](https://www.convex.dev/) with ProseMirror. Collaborative editing is supported via [ProseMirror's collab module](https://prosemirror.net/docs/ref/#collab) (which employs Operational Transformation, or OT), and its implementation is based on [this example implementation in the ProseMirror guide](https://prosemirror.net/docs/guide/#collab).

If you want to see the collaborative editing feature in action, open two tabs side-by-side (or one on another device) and start editing a note in one of them.

## Collaborative Editing with Convex

If you're interested in understanding how you might implement collaborative editing with Convex, it might be useful to use this repository as a reference.

Of primary interest to you will be:

- [The convex directory](https://github.com/rjdellecese/scroll/tree/fe3ac33935ef03b7ddf3b14d1f991cf632ffc515/src/convex)
- [The note.tsx module](https://github.com/rjdellecese/scroll/blob/fe3ac33935ef03b7ddf3b14d1f991cf632ffc515/src/elm-ts/note.tsx)

The Convex functions are written in "normal" TypeScript, but the frontend code (e.g. `note.tsx`) heavily utilizes a functional programming library ([`fp-ts`](https://github.com/gcanti/fp-ts)) and state management library ([`elm-ts`](https://github.com/rjdellecese/elm-ts)) and so is probably going to be harder for most people to grok. I'd just recommend starting with the Convex directory, as ProseMirror OT is basically the only thing going on in there. `note.tsx` is where the client-side stuff happens—look [there](https://github.com/rjdellecese/scroll/blob/fe3ac33935ef03b7ddf3b14d1f991cf632ffc515/src/elm-ts/note.tsx#L23C14-L23C14) for uses of collab and `useQuery`/`useMutation`.

This project uses an old (pre-v1.0) version of Convex, but should still be easy enough to understand—just keep in mind that some details of the Convex API might not correspond one-to-one with what you see here.

### Technical Notes and Limitations

This implementation should work beautifully at a relatively small scale (a few users editing the documenting simultaneously should be buttery smooth), but at a certain load performance will begin to degrade. This is a known problem with OT algorithms. But for the vast majority of collaborative editing use cases this should be more than sufficient.

Note also that in this implementation, no [steps](https://prosemirror.net/docs/ref/#transform.Steps) are ever thrown away, so the number of steps in a single document will grow indefinitely. The benefit of this is that any client that has ever connected to the ProseMirror document in question can always have their changes reconciled with the latest ones. However, if the number of steps ever grows too large (for most use cases this will never occur), you could come up with heuristics for determining when it is safe to throw some steps away. For example, you could track each client that connects to each ProseMirror document, and assume that clients that have not been active in the last two weeks are no longer live that we therefore don't need to keep around each step between the state of the document when they were last active and the state that it is in now (so that they might be able to reconcile any of their local changes with remote ones).

## Questions?

If you have questions about this project feel free to reach out to me directly. If you have any questions about this project's implementation of collaborative editing with Convex, consider asking them on the [Convex Discord](https://www.convex.dev/community)!
