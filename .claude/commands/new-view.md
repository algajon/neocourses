Scaffold a new view for the neoCourses app and wire it into the routing system.

The view name and role(s) are: $ARGUMENTS

Follow these steps:

1. Create `course-studio/src/views/<ViewName>/<ViewName>.tsx` — a named-export functional component. It receives at minimum `session: UserSession` as a prop if it's role-gated.
2. Create `course-studio/src/views/<ViewName>/<ViewName>.module.css` — CSS module with the standard layout shell (`.view { display: flex; flex-direction: column; height: 100%; }`). Use only `var(--token-name)` design tokens.
3. Add the view ID to the `AppView` type in `course-studio/src/components/AppSidebar/AppSidebar.tsx`.
4. Add a nav item to the `NAV` array in `AppSidebar.tsx` with appropriate `roles` array.
5. Wire the view into `App.tsx` — add a conditional render block following the same pattern as the existing views.
6. If the role should default to this view on login, update `defaultView()` in `App.tsx`.

After scaffolding, list all files created or modified and confirm the routing is complete.

Key references:
- Existing views: `EditorDashboard`, `StudentDashboard`, `AdminDashboard`, `LoginScreen`
- Types: `AppView`, `UserSession`, `UserRole` are in `src/components/AppSidebar/AppSidebar.tsx` and `src/lib/types.ts`
- Design tokens: `src/styles/variables.css`
