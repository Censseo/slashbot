import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseFrontmatter, resolveInvocationPolicy } from '../../../../src/plugins/skills/frontmatter.js';

const BUNDLED_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../skills');

describe('bundled skill discovery', () => {
  describe('nodered-setup SKILL.md', () => {
    const skillPath = join(BUNDLED_DIR, 'nodered-setup', 'SKILL.md');

    it('SKILL.md exists at the bundled path', () => {
      expect(existsSync(skillPath)).toBe(true);
    });

    it('parses frontmatter without error', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      expect(fm).toBeDefined();
    });

    it('has the correct skill name in frontmatter', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      expect(fm.name).toBe('Node-RED Setup');
    });

    it('has a non-empty description in frontmatter', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      expect(typeof fm.description).toBe('string');
      expect((fm.description as string).length).toBeGreaterThan(0);
    });

    it('has slashbot metadata with correct skillKey', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      expect(fm.slashbot?.skillKey).toBe('nodered-setup');
    });

    it('requires node binary in metadata', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      expect(fm.slashbot?.requires?.bins).toContain('node');
    });

    it('is user invocable', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      const policy = resolveInvocationPolicy(fm);
      expect(policy.userInvocable).toBe(true);
    });

    it('is model invocable (disableModelInvocation is false)', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const fm = parseFrontmatter(content);
      const policy = resolveInvocationPolicy(fm);
      expect(policy.disableModelInvocation).toBe(false);
    });

    it('has a non-empty skill body after stripping frontmatter', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
      expect(body.length).toBeGreaterThan(0);
    });

    it('body contains all expected task sections', () => {
      const content = readFileSync(skillPath, 'utf-8');
      const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
      expect(body).toContain('## Detect');
      expect(body).toContain('## Install');
      expect(body).toContain('## Start');
      expect(body).toContain('## Stop');
      expect(body).toContain('## Restart');
      expect(body).toContain('## Verify');
      expect(body).toContain('## Troubleshoot');
    });
  });
});
