import { spawn } from 'child_process';
import { ahkpath_custom, extsettings } from './server';
import { existsSync } from 'fs';

export function runscript(script: string, out?: Function): boolean {
	let executePath = ahkpath_custom || extsettings.DefaultInterpreterPath;
	if (existsSync(executePath)) {
		const process = spawn(`\"${executePath}\" /CP65001 /ErrorStdOut *`, [], { cwd: executePath.replace(/[\\/].+?$/, ''), shell: true });
		process.stdin.write(script);
		if (out) process.stdout.on('data', data => out(data.toString()));
		process.stdin.end();
		return true;
	}
	return false;
}