Create a new React component for the neoCourses app.

The component name is: $ARGUMENTS

Follow these steps exactly:

1. Determine the component directory: `course-studio/src/components/<ComponentName>/`
2. Create `<ComponentName>.tsx` — a typed functional component with named export. No default export. Use CSS Modules for all styling. No inline styles except for dynamic values (e.g. width from state).
3. Create `<ComponentName>.module.css` — co-located CSS module. Use only `var(--token-name)` CSS custom properties from `src/styles/variables.css`. Never hardcode colors or font families.
4. If the component needs props, define a `type Props = { ... }` above the function (not exported).
5. No comments unless a constraint is non-obvious.
6. After creating both files, show the user the file paths and a one-line summary of the component's purpose.

Reference the existing design tokens in `course-studio/src/styles/variables.css` for spacing, color, radius, and shadow values. The sidebar always uses `--sidebar-*` variables and stays dark — content area uses `--color-*` variables which adapt to theme.
