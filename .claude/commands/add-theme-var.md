Add a new CSS custom property to the neoCourses theme system.

The variable details are: $ARGUMENTS

Edit `course-studio/src/styles/variables.css`:

1. Add the variable to the `[data-theme="white"]` / `:root` block with the light-theme value
2. Add the variable to the `[data-theme="dark"]` block with the dark-theme value (adjust for dark backgrounds — lighter tints, higher contrast, or rgba with inverted opacity)
3. If the variable is sidebar-specific (always dark regardless of theme), add it to the `:root` block under `/* Sidebar — always dark */` instead, and do NOT add it to the theme blocks
4. Use the naming convention `--color-*` for color values, `--space-*` for spacing (prefer existing spacing tokens), `--radius-*` for border radius, `--shadow-*` for shadows

After adding, show a usage example — how a component CSS module would use `var(--your-new-variable)`.

Reference file: `course-studio/src/styles/variables.css`
