import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

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
  skillsDir: string;
  installed: string[];
  skipped: string[];
  harnesses: string[];
}

export interface InstallOptions {
  force?: boolean;
  silent?: boolean;
}

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
    if (fs.existsSync(cand) && fs.existsSync(path.join(cand, 'glide', 'SKILL.md'))) {
      return cand;
    }
  }

  // Fallback to first existing candidate
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }

  return candidates[0];
}

/**
 * Detect available AI development environments in the target project.
 */
export function detectAIEnvironments(projectRoot: string): AIEnvironmentInfo {
  return {
    antigravity: fs.existsSync(path.join(projectRoot, '.gemini')) || fs.existsSync(path.join(projectRoot, '.agents')),
    claude: fs.existsSync(path.join(projectRoot, 'CLAUDE.md')) || fs.existsSync(path.join(projectRoot, '.claude')),
    cursor: fs.existsSync(path.join(projectRoot, '.cursorrules')) || fs.existsSync(path.join(projectRoot, '.cursor')),
    windsurf: fs.existsSync(path.join(projectRoot, '.windsurfrules')),
    copilot: fs.existsSync(path.join(projectRoot, '.github', 'copilot-instructions.md')),
    agentDirExists: fs.existsSync(path.join(projectRoot, '.agents', 'skills')),
  };
}

/**
 * Install Glide AI skills into target project's .agents/skills directory.
 */
export function installSkills(projectRoot: string, options: InstallOptions = {}): InstallResult {
  const sourceDir = getSkillsSourceDir();
  const targetDir = path.join(projectRoot, '.agents', 'skills');
  const envInfo = detectAIEnvironments(projectRoot);

  const installed: string[] = [];
  const skipped: string[] = [];
  const harnesses: string[] = [];

  if (envInfo.antigravity) harnesses.push('Antigravity IDE');
  if (envInfo.claude) harnesses.push('Claude Code');
  if (envInfo.cursor) harnesses.push('Cursor');
  if (envInfo.windsurf) harnesses.push('Windsurf');
  if (envInfo.copilot) harnesses.push('GitHub Copilot');
  if (harnesses.length === 0) harnesses.push('Universal AI Agent (.agents/skills)');

  const skillNames = ['glide', 'glide-component-segregator', 'glide-setup'];

  for (const skill of skillNames) {
    const srcSkillDir = path.join(sourceDir, skill);
    const srcSkillFile = path.join(srcSkillDir, 'SKILL.md');
    const destSkillDir = path.join(targetDir, skill);
    const destSkillFile = path.join(destSkillDir, 'SKILL.md');

    if (!fs.existsSync(srcSkillFile)) {
      skipped.push(skill);
      continue;
    }

    if (fs.existsSync(destSkillFile) && !options.force) {
      skipped.push(skill);
      continue;
    }

    fs.mkdirSync(destSkillDir, { recursive: true });
    fs.cpSync(srcSkillDir, destSkillDir, { recursive: true });
    installed.push(destSkillFile);
  }

  // Also support Cursor rules if .cursor directory exists or Cursor is detected
  if (envInfo.cursor) {
    const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
    const cursorMdcFile = path.join(cursorRulesDir, 'glide.mdc');
    if (!fs.existsSync(cursorMdcFile) || options.force) {
      try {
        fs.mkdirSync(cursorRulesDir, { recursive: true });
        const mdcContent = `---
description: Glide Visual Design & AST Code-Native Editor Rules
globs: *
alwaysApply: false
---
# Glide Visual Editor Rules
- When editing visual UI components, read \`glide-components.json\` first to locate component buckets.
- Follow the skills in \`.agents/skills/glide/SKILL.md\` and \`.agents/skills/glide-component-segregator/SKILL.md\`.
- Keep source code formatting clean and use Tailwind utility replacements where appropriate.
`;
        fs.writeFileSync(cursorMdcFile, mdcContent, 'utf-8');
        installed.push(cursorMdcFile);
      } catch {
        // Non-critical
      }
    }
  }

  if (!options.silent) {
    if (installed.length > 0) {
      console.log(`[Glide] ✅ Installed ${installed.length} AI agent skill(s) into .agents/skills/`);
      for (const file of installed) {
        console.log(`        → ${path.relative(projectRoot, file)}`);
      }
      console.log(`[Glide] 🤖 Target harnesses: ${harnesses.join(', ')}`);
    } else if (skipped.length > 0 && !options.force) {
      console.log(`[Glide] ℹ️ AI agent skills already up to date in .agents/skills/`);
    }
  }

  return {
    success: installed.length > 0 || skipped.length > 0,
    skillsDir: targetDir,
    installed,
    skipped,
    harnesses,
  };
}

/**
 * Handle skill installation check, interactive prompt, or automatic installation.
 */
export async function promptOrInstallSkills(projectRoot: string, argv: string[] = process.argv): Promise<boolean> {
  // Check for opt-out
  if (argv.includes('--no-skills') || argv.includes('--skip-skills')) {
    return false;
  }

  const explicitInstall = argv.includes('--install-skills') ||
    argv.includes('-i') ||
    argv.includes('install-skills') ||
    argv.includes('init') ||
    argv.includes('--init');

  const autoYes = argv.includes('--yes') || argv.includes('-y');

  if (explicitInstall || autoYes) {
    installSkills(projectRoot, { force: true });
    return true;
  }

  // Check if primary skill already exists
  const primarySkill = path.join(projectRoot, '.agents', 'skills', 'glide', 'SKILL.md');
  if (fs.existsSync(primarySkill)) {
    return true;
  }

  // Interactive prompt if TTY
  if (process.stdin.isTTY && !process.env.CI) {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          // Timeout after 6 seconds, default to Yes
          resolve('y');
        }, 6000);

        rl.question('[Glide] 🤖 Install AI agent skills into .agents/skills for your AI editor/CLI? [Y/n] (auto-proceeds in 6s): ', (ans) => {
          clearTimeout(timer);
          resolve(ans.trim());
        });
      });

      rl.close();

      if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') {
        console.log('[Glide] Skipped AI agent skills installation.');
        return false;
      }

      installSkills(projectRoot, { force: false });
      return true;
    } catch {
      // Fallback to auto install
      installSkills(projectRoot, { force: false });
      return true;
    }
  } else {
    // Non-interactive (CI or running inside an AI harness/subagent)
    // Automatically install so the AI harness immediately gains Glide capabilities
    installSkills(projectRoot, { force: false, silent: false });
    return true;
  }
}
