# English-Only Frontend Design

## Problem

The swap interface currently exposes two Chinese RPC failure messages. A small
number of first-party frontend comments and operational script messages are also
written in Chinese, which conflicts with the product requirement that frontend
prompts and implementation comments use English.

## Scope

Translate every Chinese string and comment in first-party files under
`frontend/`, excluding generated output, installed dependencies, coverage output,
and lockfiles. This includes runtime UI messages, TypeScript/React comments, Vite
configuration comments, and shell-script comments, prompts, and status output.
Repository-level business documentation and smart-contract material remain out of
scope because they are not part of the frontend product or its operational tools.

## Runtime wording

- Balance label: `Temporarily unavailable`
- RPC error banner: `On-chain data is temporarily unavailable. Please try again later.`

The existing error-state behavior, styling, logging, and retry semantics do not
change.

## Enforcement and verification

Add a Vitest policy test that scans first-party frontend source and script file
types and reports every file and line containing Han characters. The test excludes
`node_modules`, `dist`, `coverage`, and package lockfiles. Run the policy test in a
red-green cycle, then run the full frontend test suite and configured production
build before delivery and again after merging the latest `origin/main`.

Release the change through a feature branch and pull request. Deployment uses the
existing production frontend procedure, retains the current environment values,
and is followed by a public smoke check for the new English bundle.
