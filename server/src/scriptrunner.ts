import { spawnSync } from 'child_process';
import { ahkpath_cur, extsettings, resolvePathSync } from './common';

export function runscript(script: string, out?: Function): boolean {
	let executePath = resolvePathSync(ahkpath_cur) || resolvePathSync(extsettings.InterpreterPath);
	if (executePath) {
		const process = spawnSync(`\"${executePath}\" /CP65001 /ErrorStdOut=utf-8 *`, [], { cwd: executePath.replace(/[\\/].+?$/, ''), shell: true, input: script });
		if (process) {
			if (out)
				out((process.stdout ?? '').toString());
			return true;
		}
	}
	return false;
}