import { execSync, spawnSync } from 'child_process';
import { ahkpath_cur } from './common';
import { lstatSync, readlinkSync } from 'fs';
import { resolve } from 'path';
import { type } from 'os';

export function runscript(script: string, out?: Function): boolean {
	let executePath = resolvePath(ahkpath_cur, true);
	if (executePath) {
		const process = spawnSync(`\"${executePath}\" /CP65001 /ErrorStdOut=utf-8 *`, [], { cwd: executePath.replace(/[\\/].+?$/, ''), shell: true, input: script });
		if (process) {
			out?.((process.stdout ?? '').toString());
			return true;
		}
	}
	return false;
}

export function existsSync(path: string): boolean {
	try {
		lstatSync(path);
	} catch (err) {
		if ((err as any)?.code === 'ENOENT')
			return false;
	}
	return true;
}

export function resolvePath(path: string, resolveSymbolicLink = false): string {
	if (!path)
		return '';
	let paths: string[] = [];
	if (!path.includes(':'))
		paths.push(resolve(path));
	if (!/[\\/]/.test(path) && type() === 'Windows_NT')
		paths.push(execSync(`where ${path}`, { encoding: 'utf-8' }).trim());
	paths.push(path);
	for (let path of paths) {
		if (!path) continue;
		try {
			if (lstatSync(path).isSymbolicLink() && resolveSymbolicLink)
				path = resolve(path, '..', readlinkSync(path));
			return path;
		} catch {
			continue;
		}
	}
	return '';
}