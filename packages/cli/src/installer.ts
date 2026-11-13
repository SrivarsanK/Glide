import * as fs from 'fs';
import * as path from 'path';

export interface AIEnvironmentInfo {
  antigravity: boolean;
  claude: boolean;
  cursor: boolean;
  windsurf: boolean;
  copilot: boolean;
  agentDirExists: boolean;
}

export interface InstallResult {
  success: boolean;
  /** The first skills folder written to; kept for callers of the earlier API. */
  skillsDir: string;
  /** Every skills folder written to, such as `.agents/skills` and `.claude/skills`. */
  skillsDirs: string[];
  installed: string[];
  skipped: string[];
  harnesses: string[];
}

export interface InstallOptions {
  force?: boolean;
  silent?: boolean;
  /** Where to install: 'agents' (.agents/skills), 'claude' (.claude/skills) or 'all'. Default: by detection. */
  agent?: string;
}

export const SKILL_NAMES = ['glide', 'glide-component-segregator', 'glide-setup'];

/** Where each agent reads project skills. */
const SKILL_FOLDERS: Record<string, { folder: string; label: string }> = {
  agents: { folder: path.join('.agents', 'skills'), label: 'agents that read .agents/skills (Codex, Antigravity, Cursor, and others)' },
  claude: { folder: path.join('.claude', 'skills'), label: 'Claude Code' },
};

/** Author-only content of a skill folder: test cases and test results are not instructions for an agent. */
const NOT_INSTALLED = new Set(['evals']);

/**
 * Locate the bundled or repository skills directory.
 */
export function getSkillsSourceDir(): string {
  const candidates = [
    path.join(__dirname, 'skills'),
    path.join(__dirname, '..', 'skills'),
    path.resolve(process.cwd(), 'skills'),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(path.join(cand, 'glide', 'SKILL.md'))) return cand;
  }
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return candidates[0];
}

/**
 * Detect available AI development environments in the target project.
 */
export function detectAIEnvironments(projectRoot: string): AIEnvironmentInfo {
  const has = (...parts: string[]) => fs.existsSync(path.join(projectRoot, ...parts));
  return {
    antigravity: has('.gemini') || has('.agents'),
    claude: has('CLAUDE.md') || has('.claude'),
    cursor: has('.cursorrules') || has('.cursor'),
    windsurf: has('.windsurfrules'),
    copilot: has('.github', 'copilot-instructions.md'),
    agentDirExists: has('.agents', 'skills'),
  };
}

/** The skill folders an install writes to. `.agents/skills` always; `.claude/skills` when the project uses Claude Code. */
export function skillTargets(projectRoot: string, agent?: string): string[] {
  if (agent === 'all') return Object.keys(SKILL_FOLDERS);
  if (agent) {
    if (!SKILL_FOLDERS[agent]) throw new Error(`Unknown agent "${agent}". Use one of: ${Object.keys(SKILL_FOLDERS).join(', ')}, all.`);
    return [agent];
  }
  return detectAIEnvironments(projectRoot).claude ? ['agents', 'claude'] : ['agents'];
}

/** Whether the Glide skills are in any folder that an agent reads. */
export function skillsInstalled(projectRoot: string): boolean {
  return Object.values(SKILL_FOLDERS).some(target => fs.existsSync(path.join(projectRoot, target.folder, 'glide', 'SKILL.md')));
}

/**
 * Copy the Glide skills into the project folders that AI agents read.
 * A skill that is already there is left alone unless `force` is set; with `force`
 * the folder is replaced, so files from an older version do not stay behind.
 */
export function installSkills(projectRoot: string, options: InstallOptions = {}): InstallResult {
  const sourceDir = getSkillsSourceDir();
  const envInfo = detectAIEnvironments(projectRoot);
  const targets = skillTargets(projectRoot, options.agent);
  const installed: string[] = [];
  const skipped: string[] = [];
  const harnesses: string[] = [];
  if (envInfo.antigravity) harnesses.push('Antigravity IDE');
  if (envInfo.claude) harnesses.push('Claude Code');
  if (envInfo.cursor) harnesses.push('Cursor');
  if (envInfo.windsurf) harnesses.push('Windsurf');
  if (envInfo.copilot) harnesses.push('GitHub Copilot');

  for (const target of targets) {
    const targetDir = path.join(projectRoot, SKILL_FOLDERS[target].folder);
    for (const skill of SKILL_NAMES) {
      const srcSkillDir = path.join(sourceDir, skill);
      const destSkillDir = path.join(targetDir, skill);
      const destSkillFile = path.join(destSkillDir, 'SKILL.md');
      if (!fs.existsSync(path.join(srcSkillDir, 'SKILL.md')) || (fs.existsSync(destSkillFile) && !options.force)) {
        skipped.push(destSkillFile);
        continue;
      }
      fs.rmSync(destSkillDir, { recursive: true, force: true });
      fs.mkdirSync(destSkillDir, { recursive: true });
      fs.cpSync(srcSkillDir, destSkillDir, {
        recursive: true,
        filter: source => !NOT_INSTALLED.has(path.basename(source)) || path.dirname(source) !== srcSkillDir,
      });
      installed.push(destSkillFile);
    }
  }

  // Cursor reads rules, not skill folders: a rule points it at the installed skills.
  if (envInfo.cursor) {
    const cursorMdcFile = path.join(projectRoot, '.cursor', 'rules', 'glide.mdc');
    if (!fs.existsSync(cursorMdcFile) || options.force) {
      try {
        fs.mkdirSync(path.dirname(cursorMdcFile), { recursive: true });
        fs.writeFileSync(cursorMdcFile, `---
description: Glide visual editor: how to find and edit UI source in this project
globs: *
alwaysApply: false
---
# Glide
- This project uses the Glide visual editor. Before a UI change, read \`.agents/skills/glide/SKILL.md\`.
- To find a component by name, read \`.agents/skills/glide-component-segregator/SKILL.md\`.
`, 'utf-8');
        installed.push(cursorMdcFile);
      } catch {
        // Non-critical
      }
    }
  }

  if (!options.silent) {
    if (installed.length > 0) {
      console.log(`[Glide] Installed the Glide skills (${SKILL_NAMES.join(', ')}):`);
      for (const target of targets) console.log(`        ${SKILL_FOLDERS[target].folder}${path.sep}  for ${SKILL_FOLDERS[target].label}`);
      if (!targets.includes('claude')) console.log('[Glide] For Claude Code, run: npx @srivarsank/glide install-skills --agent claude');
    } else if (skipped.length > 0) {
      console.log('[Glide] The Glide skills are already installed. Use --force to replace them with this version.');
    }
  }

  const skillsDirs = targets.map(target => path.join(projectRoot, SKILL_FOLDERS[target].folder));
  return { success: installed.length > 0 || skipped.length > 0, skillsDir: skillsDirs[0], skillsDirs, installed, skipped, harnesses };
}

/**
 * Install the skills when the command asks for it; otherwise only say how.
 * Starting the editor never writes skill files into the project by itself.
 */
export async function promptOrInstallSkills(projectRoot: string, argv: string[] = process.argv): Promise<boolean> {
  if (argv.includes('--no-skills') || argv.includes('--skip-skills')) return false;

  const explicitInstall = ['--install-skills', '-i', 'install-skills', 'init', '--init'].some(flag => argv.includes(flag));
  if (explicitInstall) {
    const agentIndex = argv.indexOf('--agent');
    installSkills(projectRoot, {
      // An explicit install brings the project to this version, unless only missing skills are wanted.
      force: true,
      agent: agentIndex >= 0 ? argv[agentIndex + 1] : undefined,
    });
    return true;
  }

  if (skillsInstalled(projectRoot)) return true;
  console.log('[Glide] Tip: to teach your AI coding agent about Glide, run: npx @srivarsank/glide install-skills');
  return false;
}
