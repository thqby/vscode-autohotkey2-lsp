import { spawnSync } from 'child_process';
import { extsettings } from './global';
import { existsSync } from 'fs';
import { ahkpath_cur } from './server';

export function runscript(script: string, out?: Function): boolean {
	let executePath = ahkpath_cur || extsettings.InterpreterPath;
	if (existsSync(executePath)) {
		const process = spawnSync(`\"${executePath}\" /CP65001 *`, [], { cwd: executePath.replace(/[\\/].+?$/, ''), shell: true, input: script });
		if (process) {
			if (out)
				out(process.stdout.toString());
			return true;
		}
	}
	return false;
}