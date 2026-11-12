# Documentation index

Start with [README](../README.md) for product usage and
[CONTRIBUTING](../CONTRIBUTING.md) for checkout setup, the current module map,
validation and releases. The source and executable checks establish current
behavior when an older specification disagrees.

## Working references

- [Installation](INSTALL.md): integrating the published package into an app.
- [UI navigation](ui-navigation-guide.md) and [Figma concepts](FIGMA_GUIDE.md):
  editor usage references; verify details against the current editor.
- [Bundled skills](../skills/): installation and source-editing guidance shipped
  with the package.
- [Test suite](../src/__tests__/README.md): test locations and coverage areas.
- [Repository cleanup audit](reports/REPOSITORY_CLEANUP.md): removed files,
  evidence, retained compatibility surfaces and validation results.

## Historical specifications and research

These documents record designs, proposals or observations at a point in time.
They are retained for context, but are not requirements to recreate removed code:

| Documents | Known limitation |
| --- | --- |
| `FEATURES.md`, `Glide-Coding-Agent-Prompt.md` | Describe the earlier Jotai/React editor and workspace tooling |
| `Glide-History-Feature-Spec.md`, `Glide-Porting-Safety-Spec.md` | Reference removed React history components and Jotai atoms |
| `prd.md`, `staged-edits-buffer.md` | Product/design proposals; implementation has evolved |
| `reports/` (other than the current cleanup audit) | Dated audit and completion snapshots, not a live backlog |
| `research/`, `Cloning Figma_ A Comprehensive Guide.md`, `figma-v0-architectural-framework.md` | External architecture research, not implemented features |
| `DESIGN.md`, `AST-Explorer-Resource.md` | Design and investigation references |
| `atomic-commit.md`, `cst-node.md` | Earlier agent guidance; current repository rules are in `.agents/AGENTS.md` |

Historical paths remain stable so existing links and research references keep
working. Do not infer that a feature is implemented solely because it appears
in one of these documents.
