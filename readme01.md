# Jean

Jean is a Tauri + React desktop AI assistant for managing multiple projects, git worktrees, and Claude CLI sessions in one place.

## Features
- Automated worktree management
- Load context from sessions, GitHub Issues, and Pull Requests
- Automated (magic) git actions: review, commit, open PR, investigate issue/PR
- Automated GitHub PR or local merge worktrees
- Automated merge conflict resolver
- Archive and restore worktrees/branches

## Tech Stack
- Tauri v2 (Rust backend)
- React 19 + Vite 7 (frontend)
- TanStack Query for persistent data
- Zustand for global UI state
- Tailwind CSS v4 + shadcn/ui components
- Vitest for frontend tests

## Prerequisites
- Node.js LTS (v20+)
- npm
- Rust stable toolchain

Platform-specific dependencies:
- macOS: Xcode Command Line Tools
- Linux (Debian/Ubuntu): libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
- Windows: none

## Quick Start
```bash
npm install
npm run tauri:dev
```

## Common Commands
- `npm run tauri:dev` - start the app in dev mode
- `npm run tauri:dev:rdp` - dev mode with RDP/xrdp support
- `npm run tauri:build` - build a production app
- `npm run check:all` - run all quality gates
- `npm run test:run` - run frontend tests once
- `npm run rust:test` - run Rust tests

## Project Structure
```
src/          React frontend
src-tauri/    Rust backend
docs/         Architecture and dev guides
scripts/      Helper scripts
```

## Platform Support
- macOS: tested
- Windows: not tested
- Linux: not tested

## Roadmap
- Opencode support
- Remote access API

## Contributing
See `CONTRIBUTING.md` for setup, commands, and development guidelines.

## License
Apache-2.0
