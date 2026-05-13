Run the neoCourses test suite and report results.

Execute the following command from `course-studio/`:

```bash
export PATH="/usr/local/opt/node/bin:/usr/local/bin:$HOME/.cargo/bin:$PATH"
cd course-studio && npm test 2>&1
```

Then:
1. Count passing vs failing tests.
2. For each failing test: show the test name, the assertion that failed, and the file path with line number.
3. If all tests pass, say so clearly with the count.
4. If there are failures, attempt to fix them — read the relevant source file first, understand the root cause, then make the minimal fix. Re-run tests to confirm.

Test files are co-located with components (e.g. `CourseBriefForm.test.tsx`). The test setup is in `src/test-setup.ts`. Tauri APIs are mocked via `vi.mock('@tauri-apps/api/core')`.
