# Session Memory - Guigu Project

## Project Overview
- **Name**: Guigu (硅股) - Rust AI Agent Runtime
- **Location**: `/home/fhy/guigu/`
- **Language**: Rust (edition 2024)
- **Toolchain**: rustc 1.98.0, cargo 1.98.0

## Architecture
- 3-agent system: Planner (Architect), Worker (Developer), Reviewer
- Communication via Matrix protocol with E2EE encryption
- ACP (Agent Communication Protocol) for AI backend integration

## Agent Accounts
| Agent | Matrix ID | Role | ACP Backend |
|-------|-----------|------|-------------|
| Planner | @guigu-planner:matrix.0x8.xyz | Senior Systems Architect | codebuddy + deepseek-v4-pro |
| Worker | @guigu-worker:matrix.0x8.xyz | Senior Rust Engineer | qwen --acp + Qwen3.8-27B-Local |
| Reviewer | @guigu-reviewer:matrix.0x8.xyz | Senior Code Review Expert | opencode acp + hy3-free |
| Assistant | @opencode-assistant:matrix.0x8.xyz | Project Assistant | opencode acp |

## Current Issues
1. **Task 001 Deadlock**: `wait_for_idle()` in `agent.rs:418` waits on `self.idle.notified().await` but initial state has no notification. Needs design decision from Planner.

2. **qwen Thinking Mode**: Model returns `reasoning_content` but qwen ACP only checks `contentText`. Configured `extraBody` with `chat_template_kwargs.enable_thinking: false` but not verified.

3. **hy3-free Empty Response**: Reviewer sometimes returns no text after running tools.

## Key Files
- `src/core/agent.rs` - Core agent implementation
- `src/acp_client.rs` - ACP client
- `tests/agent_lifecycle.rs` - Agent lifecycle tests (deadlock here)
- `docs/conventions.md` - Workflow and coding standards
- `docs/agent-communication-issues.md` - Known issues

## Collaboration Rules
- PM coordinates, agents communicate directly
- Worker escalates design issues with `[Architecture Review]`
- Planner responds with `[Architecture Decision]`
- Reviewer provides strict but fair code review

## Environment
- Matrix homeserver: https://matrix.0x8.xyz
- PM user: @fhy:matrix.0x8.xyz
- Local AI: qwen at 192.168.9.10:8080
- Bun unavailable, using tsx for TypeScript execution