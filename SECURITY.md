# Security Policy

## Supported versions

Security fixes go into the latest released version of `@srivarsank/glide`.

## Report a vulnerability

Do not open a public issue for a security problem.

Use GitHub's private report form: open the repository's **Security** tab and select **Report a vulnerability**.

Include:
- the Glide version and how you run it (the `glide` command, or the Vite plugin at `/__glide/`);
- the steps to reproduce the problem;
- what an attacker can read or change.

## Scope

Glide is a development tool. It runs on your machine and writes to your source files, so these are in scope:
- a web page or a script that can send edits to the Glide server without your action;
- a request that reads or writes a file outside the project folder;
- a way to get the editor session token from another origin.

A problem that needs a person to run a command on your machine is out of scope.
