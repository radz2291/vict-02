# VICT Studio re-entry review — 8 November 2026

The isolated production preview ran from `6b420a3e9eada6f694cc2550debda7753316b5b3`, which matched remote main at review. Its product and build inputs match the independently tested mainline candidate recorded in the [integration record](FOUNDATION-MAINLINE-INTEGRATION-20261102.md).

## Preview and checks

- Built in a detached worktree and served through SvelteKit's production Node adapter at `http://127.0.0.26:5638/design`. The preview used a separate browser origin, a dedicated Edge review profile, and a separate temporary directory for agent data.
- The existing Studio listener at `127.0.0.25:5626` continued serving its installed build from `2de11bc7719984f23341852b1cc8b9985ff81adf`. All 398 installed files matched the production seal. The review used a historical Project Planner export and did not access the existing instance's browser data.
- Locked dependency installation, shared package builds, the Studio production build, and 21 targeted Structure, portal, and source-semantics tests passed. The first package build hit a Windows workspace-link resolution error. It passed after moving the isolated checkout to the established worktree directory.
- In Edge, the export imported and rendered. Structure opened, Fit all worked, and searching for Help surfaced the dialog. Switching from Interact to Structure with Help open hid the dialog and left Studio clickable. Returning to Interact restored the dialog and allowed normal dismissal.
- A manual screen rename was undone, redone, saved, and verified after both reopening the saved version and reloading the browser.

## Live agent timing

One turn on a disposable Project Planner import used the existing Z.AI Coding Plan route with `zai/glm-5.3-flash`. It changed one visible heading with one confirmed, undoable edit. Studio measured **14.9 s to first confirmed edit** and **23.1 s to completion**. Edge observed the heading change at **15.326 s** and terminal status at **23.246 s** from immediately before Send. The copy remained unsaved. This was a single sample.

## Milestone 2 requirement

**Stream live, user-visible reasoning text separately from the answer.** Show the reasoning text as it arrives in a distinct activity surface while the turn is running. Use reasoning summaries or other text explicitly designated for public display.

On the tested Z.AI route, Mastra emitted reasoning lifecycle events, and the public VICT adapter did not forward them. When Milestone 2 resumes, assess a compatible public activity signal and measure waiting, reasoning, tool execution, and edit application separately before choosing what to optimize. Milestone 2 remains paused.
