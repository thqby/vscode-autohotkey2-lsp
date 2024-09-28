import { execSync } from 'child_process';
import { lstatSync, readlinkSync } from 'fs';
import { resolve } from 'path';

/**
 * Returns the provided path as an absolute path.
 * Resolves the provided path against the provided workspace.
 * Resolves symbolic links by default.
 * Returns empty string if resolution fails.
 */
export function resolvePath(
	path: string | undefined,
	workspace?: string,
	resolveSymbolicLink = true,
): string {
	if (!path) return '';
	const paths: string[] = [];
	// If the path does not contain a colon, resolve it relative to the workspace
	if (!path.includes(':')) paths.push(resolve(workspace ?? '', path));
	// If there are no slashes or backslashes in the path and the platform is Windows
	if (!/[\\/]/.test(path) && process.platform === 'win32')
		paths.push(execSync(`where ${path}`, { encoding: 'utf-8' }).trim());
	paths.push(path);
	for (let path of paths) {
		if (!path) continue;
		try {
			if (lstatSync(path).isSymbolicLink() && resolveSymbolicLink)
				path = resolve(path, '..', readlinkSync(path));
			return path;
		} catch {}
	}
	return '';
}
