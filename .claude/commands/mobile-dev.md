Start the Expo dev server for the courseneo mobile companion app.

Optional arguments (platform / flags): $ARGUMENTS

Steps:

1. Confirm `course-mobile/` exists with a `package.json`. If not, tell the user to run the `scaffold-mobile` skill first, and stop.
2. Ensure Node is on PATH: `export PATH="/usr/local/opt/node/bin:/usr/local/bin:$PATH"`.
3. From `course-mobile/`, start Expo:
   - default: `npm run start`
   - if `$ARGUMENTS` names a platform, pass it through (e.g. `npm run start -- --ios`, `--android`, `--web`, or `--tunnel`).
   Run it in the background so the dev server keeps running.
4. Surface the QR / dev URL Expo prints so the user can open the app in Expo Go or a dev build.
5. Remind the user that to test pairing end to end, the **desktop** app must also be running with the pairing panel open, and the phone must be on the **same LAN**. Point them at the `pair-device` skill for a guided test.

Notes:
- Do not eject or switch to the bare workflow as part of this command.
- If the Metro/Expo port is already in use, identify and offer to free it rather than silently picking a new port.
