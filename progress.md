Original prompt: At kine player moving anything is broken. Clarification: the default character animation on entry has broken legs, hands, and sword without any input.

- Baseline: public `/kine/` at commit `506c187`; local branch `fix/kine-idle-animation`, clean before this visual repair.
- Reproduced in the public browser: idle shoe soles are 0.146 m above the floor. The entry pose has no walk/attack/jump state, and idle movement is only about 0.002 m of body bob.
- Scope: repair idle ground contact and coordinated hand/sword movement within the existing character rig. Verify the same entry view and a moving preview at desktop and narrow viewport, plus numeric geometry checks.
- Geometry tests reproduced the idle shoe gap (0.146 m) and missing visible sword motion before the fix. The repaired pose aligns shoes with the floor, keeps the support foot within 4 cm during the walk cycle, and keeps the sword above the floor in idle and attack.
- The idle loop now uses simulation time, so pause freezes its pose. The sword rests diagonally outside the right boot and remains attached to the hand.
- Playwright client and in-app browser inspected desktop and narrow viewport captures. The before/after comparison is `output/kine-idle-before-after.png` (test artifact, not a release asset).
- Final local checks: `npm run build:kine`, `npm test` (all passing), Playwright client capture, in-app browser desktop and narrow viewport inspection, and browser pause check (same engine time and sword transform while paused). The browser console had no errors, and the observed desktop renderer remained at 60 fps on this PC.
- Pending: user approval to promote the tested branch into the public release. The live GitHub Pages site still serves the before version. Physical phone performance and appearance remain unverified.
