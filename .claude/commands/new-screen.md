Create a new React Native screen for the courseneo mobile companion app (`course-mobile/`).

The screen name is: $ARGUMENTS

Follow these steps exactly:

1. Confirm `course-mobile/` exists. If it does not, tell the user to run the `scaffold-mobile` skill first, and stop.
2. Determine the screen location to match the app's navigation convention already in `course-mobile/` (e.g. `app/<screen>.tsx` for expo-router, or `src/screens/<ScreenName>/`). Inspect the existing structure before choosing — do not invent a new convention.
3. Create the screen as a **typed functional component with a named export**. No default export unless the router requires one (expo-router route files do — follow whatever sibling routes do).
4. Styling: use React Native `StyleSheet.create` with values pulled from the shared mobile theme/tokens if one exists; otherwise create minimal local styles. Mirror the desktop brand: dark surfaces, `course` + accented `neo` wordmark, accent `#e5ff00`.
5. If the screen makes network calls, route them through the existing upload/pairing client module — never inline `fetch` against the desktop server, and never redefine protocol types (import from `packages/shared`).
6. Wire the screen into navigation (add the route / stack entry) consistent with siblings.
7. Keep the phone a thin remote: pairing, file/brief selection, upload, status only. No course/lesson/quiz rendering.
8. No comments unless a constraint is non-obvious.
9. After creating the files, show the user the file paths, the route it's reachable at, and a one-line summary of the screen's purpose.

If anything about the target structure is ambiguous because `course-mobile/` is still minimal, prefer matching `docs/ARCHITECTURE.md` (§3 screens) and ask only if a real fork in convention exists.
