Add a new file type to the neoCourses ImportPanel.

The new file type details are: $ARGUMENTS

Edit `course-studio/src/components/ImportPanel/ImportPanel.tsx`:

1. Add the new type to `FileType` union: `type FileType = 'pdf' | 'audio' | 'video' | 'doc' | '<newtype>'`
2. Add an entry to `FILE_META` with `icon` (emoji), `color` (hex), and `label` (display name)
3. Add the file extensions to `ACCEPT_EXTS` record
4. Update `getFileType()` so those extensions map to the new type
5. The `open()` dialog filter list at the bottom of `handleBrowse()` — add the extensions to the "All supported" filter and create a new named filter for this type

After editing, run `npm run build` from `course-studio/` to confirm no TypeScript errors.

Reference file: `course-studio/src/components/ImportPanel/ImportPanel.tsx`
