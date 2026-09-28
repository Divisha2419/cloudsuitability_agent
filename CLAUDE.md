# CLAUDE.md

This file gives Claude Code (claude.ai/code) guidance for working in this repository.

## Project overview

`cloudsuitability_agent` is an agent that assesses how suitable a user's application is for running in the cloud. Users describe their application, and the agent evaluates it and reports on its cloud suitability.

## Current state

The repository is at an early stage: it contains only `README.md` and this file. There is no source code, dependency manifest, build system, test suite, or CI configuration yet.

When adding the first code:
- Update this file with the chosen language/framework, how to install dependencies, and the commands to build, lint, test, and run the agent.
- Record the high-level architecture (for example, input intake, the assessment criteria and scoring, and report generation) once it exists.

## Working conventions

- Keep `README.md` user-facing (what the agent does and how to use it) and keep this file focused on guidance for development.
- Do not commit secrets such as API keys or cloud credentials. Load them from environment variables.
