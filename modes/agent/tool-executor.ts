import fs from "node:fs"
import path from "node:path"
import { homedir } from "node:os"
import { spawnSync } from "node:child_process"
import type { AgentConfig, ActionLog } from "./types"
import { ActionTracker } from "./action-tracker"

const TEXT_EXT = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.mdx',
    '.css',
    '.html',
    '.yml',
    '.yaml',
    '.toml',
    '.txt',
]);

function isProbablyTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return TEXT_EXT.has(ext) || ext === ''
}

export class ToolExeceutor {
    private overlay = new Map<string, string>();
    private deleted = new Set<string>();
    private readonly norm = (rel: string) => path.posix.normalize(rel.split(path.sep).join("/")).replace(/^\.\//, "")

    constructor(
        private readonly tracker: ActionTracker,
        private readonly config: AgentConfig
    ) { }

    private resolveSafe(rel: string): string {
        const abs = path.resolve(this.config.codebasePath, rel);
        const root = path.resolve(this.config.codebasePath);
        const relCheck = path.relative(root, abs);

        if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
            throw new Error(`Path escapes workspace: ${rel}`);
        }

        return abs;
    }

    // checks if the file has to be included or excluded from processing
    private excluded(relPath: string): boolean {
        const norm = this.norm(relPath);
        const segments = norm.split('/');
        const base = segments[segments.length - 1] ?? '';

        for (const pat of this.config.excludePatterns) {
            if (pat === '*.log' && base.endsWith('.log')) return true;
            if (pat === '.env*' && base.startsWith('.env')) return true;
            if (pat.includes('*')) continue;

            if (segments.includes(pat) || norm === pat || norm.startsWith(`${pat}/`))
                return true;
        }

        return false;
    }

    private assertNotExcluded(rel: string, op: string): void {
        if (this.excluded(rel)) {
            throw new Error(`${op}: path is excluded by policy: ${rel}`);
        }
    }
} 