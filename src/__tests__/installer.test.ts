import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectAIEnvironments,
  getSkillsSourceDir,
  installSkills,
  promptOrInstallSkills,
} from '../../packages/cli/src/installer';

describe('Glide AI Skill Installer', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glide-install-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on windows
    }
  });

  it('should locate valid skills source directory', () => {
    const srcDir = getSkillsSourceDir();
    expect(fs.existsSync(srcDir)).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'glide', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'glide-component-segregator', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(srcDir, 'glide-setup', 'SKILL.md'))).toBe(true);
  });

  it('should detect various AI environments accurately', () => {
    const emptyDetect = detectAIEnvironments(tempDir);
    expect(emptyDetect.antigravity).toBe(false);
    expect(emptyDetect.claude).toBe(false);
    expect(emptyDetect.cursor).toBe(false);
    expect(emptyDetect.windsurf).toBe(false);
    expect(emptyDetect.copilot).toBe(false);

    // Create marker files
    fs.mkdirSync(path.join(tempDir, '.agents'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Claude Config');
    fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor rules');
    fs.writeFileSync(path.join(tempDir, '.windsurfrules'), '# Windsurf rules');
    fs.mkdirSync(path.join(tempDir, '.github'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, '.github', 'copilot-instructions.md'), '# Copilot');

    const detected = detectAIEnvironments(tempDir);
    expect(detected.antigravity).toBe(true);
    expect(detected.claude).toBe(true);
    expect(detected.cursor).toBe(true);
    expect(detected.windsurf).toBe(true);
    expect(detected.copilot).toBe(true);
  });

  it('should install all skills into .agents/skills/ in target project', () => {
    const res = installSkills(tempDir, { silent: true });
    expect(res.success).toBe(true);
    expect(res.installed.length).toBeGreaterThanOrEqual(3);

    const targetDir = path.join(tempDir, '.agents', 'skills');
    expect(fs.existsSync(path.join(targetDir, 'glide', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'glide-component-segregator', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'glide-setup', 'SKILL.md'))).toBe(true);

    // Verify content of installed skill
    const content = fs.readFileSync(path.join(targetDir, 'glide', 'SKILL.md'), 'utf-8');
    expect(content).toContain('name: glide');
    expect(content).toContain('In-Memory SceneGraph');
    expect(content).toContain('Property Delta Queue');
  });

  it('should skip already installed skills unless force is true', () => {
    installSkills(tempDir, { silent: true });
    const res2 = installSkills(tempDir, { force: false, silent: true });
    expect(res2.installed.length).toBe(0);
    expect(res2.skipped.length).toBeGreaterThanOrEqual(3);

    const resForce = installSkills(tempDir, { force: true, silent: true });
    expect(resForce.installed.length).toBeGreaterThanOrEqual(3);
  });

  it('should install Cursor rule when Cursor environment is detected', () => {
    fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor config');
    const res = installSkills(tempDir, { silent: true });
    expect(res.harnesses).toContain('Cursor');
    expect(fs.existsSync(path.join(tempDir, '.cursor', 'rules', 'glide.mdc'))).toBe(true);
  });

  it('should respect --no-skills flag in promptOrInstallSkills', async () => {
    const result = await promptOrInstallSkills(tempDir, ['node', 'cli.js', '--no-skills']);
    expect(result).toBe(false);
    expect(fs.existsSync(path.join(tempDir, '.agents', 'skills', 'glide', 'SKILL.md'))).toBe(false);
  });

  it('should install immediately when --install-skills is provided', async () => {
    const result = await promptOrInstallSkills(tempDir, ['node', 'cli.js', '--install-skills']);
    expect(result).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.agents', 'skills', 'glide', 'SKILL.md'))).toBe(true);
  });

  it('should validate YAML frontmatter in all skill files', () => {
    const srcDir = getSkillsSourceDir();
    const skills = ['glide', 'glide-component-segregator', 'glide-setup'];

    for (const skill of skills) {
      const filePath = path.join(srcDir, skill, 'SKILL.md');
      const text = fs.readFileSync(filePath, 'utf-8');
      expect(text.startsWith('---')).toBe(true);
      expect(text).toMatch(/name:\s*[\w-]+/);
      expect(text).toMatch(/description:/);
    }
  });
});
