# ShellBlocks Project Guidelines

This file supplements the global engineering guidelines with rules and context specific to ShellBlocks.

Do not duplicate or override global guidance unless a project-specific constraint requires it.

## Project Identity

ShellBlocks is a visual programming environment for teaching command-line interfaces, Shell concepts, and command composition.

Its identity is not limited to Linux or Bash. The current implementation primarily targets Linux/Unix commands and Bash-like Shell syntax, but avoid unnecessarily treating platform-specific behavior as an intrinsic property of ShellBlocks when the modeled concept is more general.

Do not prematurely introduce abstractions for hypothetical platforms. Generalize when the domain naturally supports it or an actual requirement exists.

## Architecture

The project is entirely TypeScript.

ShellBlocks is intentionally a frontend-centric application. There is no application state that needs server-side persistence, and the application is simple enough that its domain logic does not require a backend.

Therefore, all application and domain behavior belongs in the frontend, including:

* command and block semantics;
* validation;
* Shell generation;
* level and progression logic;
* session state;
* application UI.

The backend exists only because browser code cannot directly execute the generated CLI commands in the required environment.

Its responsibility is to:

* serve the built frontend;
* receive execution requests;
* execute scripts through Docker as a sandbox;
* return the execution result.

Keep the backend limited to that execution boundary. Do not move application logic to it without an explicit architectural decision from the user.

## Frontend Structure

### `core/shellblocks`

`frontend/src/core/shellblocks/` contains the reusable visual and semantic core of ShellBlocks.

This includes concerns such as block definitions, semantic metadata, AST representation, Shell generation, validation, serialization, workspace behavior and block-related UI.

Keep it independent from behavior that exists specifically because of the current educational application, such as level progression or page orchestration.

### `pages/features`

`frontend/src/pages/features/` contains application-specific functionality, including execution, sessions, levels and page-level UI behavior.

Code whose meaning depends on the current ShellBlocks application belongs here rather than in the reusable core.

### Other core modules

Code under `frontend/src/core/` that is generic rather than a ShellBlocks concept may remain outside `core/shellblocks`, such as generic persistence or utility functionality.

Do not move something into `core/shellblocks` merely because ShellBlocks uses it.

## Project Organization

Prefer a screaming architecture: project structure and module names should expose the concepts that matter to ShellBlocks.

Organize code around responsibilities such as:

* validation;
* generation;
* serialization;
* workspace behavior;
* execution;
* session;
* levels;
* command definitions.

Do not introduce generic architectural layers such as repositories, services, managers, controllers or factories merely to conform to a conventional application template.

Such names and abstractions are appropriate when they describe a real responsibility.

Preserve coherent existing boundaries rather than reorganizing files for symmetry alone.

## Data-Driven Configuration

Important ShellBlocks behavior is defined by:

```text
frontend/src/assets/data/cli_definitions.json
frontend/src/assets/data/levels.json
```

Their formats are documented in:

```text
docs/cli_definitions.md
docs/levels.md
```

`cli_definitions.json` contains the declarative model for commands, options, operands, operators, controls and toolbox categories.

Use configuration for declarative facts. Keep behavior that is inherently procedural or semantic in TypeScript rather than forcing it into JSON merely to make the application more data-driven.

`levels.json` defines the educational progression, including presentation, setup commands, optional verification scripts, difficulty and ordering.

When changing either format, keep the TypeScript model, existing data and corresponding documentation consistent.

When changing a level, make its verification test the intended learning objective rather than an accidental property of one possible solution.

## Shell Generation and Validation

Preserve a clear distinction between the semantic block representation, intermediate representations such as the AST, generated Shell source and execution results.

Do not reconstruct Shell directly from incidental UI state when the required semantics already exist in the model.

Prefer validation of the semantic model rather than inferring correctness from generated Shell text.

Validation and feedback should identify the actual kind of failure when the application has enough information to do so. Structural validation, invalid values, command execution failures and level-verification failures are different concepts.

## User Interface and Pedagogy

ShellBlocks is an educational tool. Correct implementation is not sufficient if the interface teaches the wrong mental model.

Preserve the conceptual distinction between commands, options, option arguments, operands, operators and control structures.

Do not make accidental interface difficulty part of an exercise. Difficulty discovering a valid Blockly connection, finding the expected category or realizing that a value must be typed is not pedagogical challenge unless deliberately designed as such.

At the same time, guidance should help users operate the interface without automatically revealing the solution.

Keep actual command output distinct from ShellBlocks validation, educational feedback and internal/debug messages.

## Branches and Compatibility

The repository currently uses two main branches:

* `dev`: active development;
* `main`: stable project history.

The project has not reached version `1.0` yet.

Backward compatibility is therefore not required unless the user explicitly says otherwise.

Do not preserve obsolete internal APIs, data formats or implementation details merely for compatibility during pre-1.0 development.

Prefer the cleaner current design when a breaking change is appropriate for the task.

Do not merge, rebase, push, tag or modify branch history unless the user explicitly asks for it.

## Generated Files and Build Artifacts

The frontend is built using Vite and the Single File plugin.

The project build incorporates the resulting page into the backend and ultimately produces the distributable server artifact:

```text
frontend source
    ↓
frontend/dist/index.html
    ↓
backend/build/frontend/index.html
    ↓
backend build
    ↓
backend/dist/server.js
    ↓
dist/shellblocks-server.js
```

`frontend/dist/`, `backend/build/`, `backend/dist/` and the root `dist/` directory contain generated build outputs or intermediate artifacts.

Treat generated outputs as generated outputs.

Do not implement source changes by editing generated files directly. Modify their source and regenerate them through the normal build process.

In particular, `backend/build/frontend/index.html`, `backend/dist/server.js` and `dist/shellblocks-server.js` must not be treated as the source of truth for frontend or backend behavior.

## Build, CI/CD, Deployment and Verification

The frontend and backend are separate npm packages.

Use the scripts defined in their respective `package.json` files.

The canonical full-project build is:

```text
build_project.sh
```

It is used both locally and by GitHub Actions.

`build_project.ps1` provides the equivalent project build for PowerShell environments.

### Automated Builds and Releases

The GitHub Actions build workflow runs automatically on:

* pushes to `dev`;
* version tags matching `v*`.

It can also be triggered manually through `workflow_dispatch`.

For `dev` pushes, the generated `dist/shellblocks-server.js` artifact is uploaded as a short-lived development build.

Releases are not created automatically from ordinary commits or merges. The user explicitly decides when a version should be released and manually creates and pushes a version tag matching `v*`.

When such a tag is pushed, GitHub Actions builds the project, renames the generated artifact using the tag and publishes it as a GitHub Release asset.

The build script exports `GENERATED_ARTIFACT_PATH`, and the CI workflow relies on that value to locate the final artifact.

When changing build or packaging behavior, preserve this contract or update the workflow consistently.

### Production Deployment

ShellBlocks has a production deployment hosted on an Oracle Cloud Free Tier virtual machine.

The production infrastructure consists of:

* an Ubuntu server on Oracle Cloud Free Tier;
* PM2 managing the `shellblocks-server.js` Node.js process;
* DuckDNS providing the public hostname;
* nginx acting as the public-facing reverse proxy and providing HTTPS termination with a valid TLS certificate.

The deployed application itself is the self-contained `shellblocks-server.js` artifact. The production server does not contain a source checkout or perform application builds.

Production deployment is intentionally separate from the automated build and release process.

Deployments are never triggered automatically by pushes, merges or releases. The production deployment workflow is exposed exclusively through `workflow_dispatch` and must be started manually by the user.

The deployment workflow:

1. checks out the selected repository revision;
2. runs the canonical full-project build;
3. configures SSH using the production environment credentials stored in GitHub;
4. transfers `dist/shellblocks-server.js` to the production server as a temporary JavaScript file;
5. validates the transferred artifact with `node --check`;
6. atomically replaces the deployed `shellblocks-server.js` with the validated artifact;
7. restarts the `shellblocks` process through PM2;
8. performs a local HTTP health check against the application, with retries, and fails the deployment if the application does not become available.

The deployment uses a dedicated SSH identity rather than the user's personal SSH identity.

Do not introduce automatic production deployment as a side effect of builds, pushes, merges, tags or releases unless the user explicitly decides to change this deployment policy.

### Verification

For changes that can affect packaging or integration, run the complete project build instead of validating only an individual package.

Do not claim that a change is ready for integration if the relevant build or tests have not been run.

## Local Backlog

`agents_refs.local/TODO.md` is a local working backlog and is already ignored by `.gitignore`.

Do not version it.

The user defines the scope of the current task. `agents_refs.local/TODO.md` may provide context, but its contents are not implicit instructions to implement anything.

## Documentation

The main project documentation is:

```text
README.md
docs/cli_definitions.md
docs/levels.md
```

Keep these documents consistent with changes to the architecture or documented configuration formats.

Use `README.md` for the project and architectural overview, and `docs/` for detailed reference material. Avoid duplicating detailed reference documentation into the README.

## Scope Discipline

Stay within the task requested by the user.

Do not perform unrelated refactors or structural reorganizations on your own. Structural refactoring should be explicitly agreed with the user.

If a potentially useful improvement falls outside the requested task, mention it and ask before expanding the scope.
