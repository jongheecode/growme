---
name: feedback-unattended-execution
description: User steps away mid-session and wants execution to continue without permission-prompt interruptions
metadata: 
  node_type: memory
  type: feedback
  originSessionId: beeebcb0-7242-4d1b-927b-90d75b7c5d48
---

The user frequently steps away mid-session ("나 외출할거니까", "나갔다올거니까") and explicitly wants work to keep proceeding without stopping on permission prompts they can't respond to.

**Why:** They said outright they can't accept prompts while away, and asked to have prompts configured off entirely so execution isn't blocked.

**How to apply:** When they signal they're stepping away, proactively broaden `.claude/settings.json` permissions (allow `Read`, `Agent`, `Task*`, common read-only git commands, the project's test/build commands; `defaultMode: acceptEdits`) rather than waiting to be asked, and keep executing the current plan/task queue autonomously (continuous execution per superpowers:subagent-driven-development — only stop for a genuine BLOCKED status). Still never take destructive/irreversible actions (force-push, reset --hard, rm -rf, etc.) on their behalf just because prompts are broadened — the permission relaxation is about unblocking routine dev-loop commands (tests, commits, subagent dispatch), not a blanket license for risky ops. Also proactively save progress to memory when they say something like "저장해놔" (save what's done) so a fresh session can resume without re-deriving context — see [[project_v15_desktop_shell_profile]] for the pattern (ledger file + memory pointer to exact resume point).
