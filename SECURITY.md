# Security Policy

## Supported versions

Security fixes are applied to the **latest release** on [GitHub Releases](https://github.com/vgoloviznin/family-genealogy/releases) and to the `main` branch. Older installers are not backported unless a release is still widely used and the issue is severe.

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report via [GitHub Private Vulnerability Reporting](https://github.com/vgoloviznin/family-genealogy/security/advisories/new).  
If that form is unavailable, enable it under **Settings → Code security → Private vulnerability reporting**, or contact the [repository owner on GitHub](https://github.com/vgoloviznin) without posting exploit details publicly.

Include:

- Affected version / commit / OS
- Steps to reproduce or a proof of concept
- Impact (data disclosure, RCE in Electron context, path traversal on project folders, etc.)

You should get an acknowledgement within **7 days**. We will coordinate a fix and, when appropriate, a public advisory and patched release.

## Scope notes

This is a **local-first** desktop app: project data lives in user-chosen folders. Reports about social-engineering users into opening untrusted `.fgtree` archives or unsigned installers are welcome when they involve a clear product defect (e.g. unsafe unpack paths). Supply-chain issues in dependencies should include the package name and CVE when known.
