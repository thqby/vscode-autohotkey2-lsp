import * as child_process from 'child_process';
import { globalSettings } from './server';
import * as fs from 'fs';

export function runscript(script: string, out?: Function): boolean {
	let executePath = globalSettings.Path;
	if (fs.existsSync(executePath)) {
		const process = child_process.spawn(`\"${executePath}\" /CP65001 /ErrorStdOut *`, [], { cwd: executePath.replace(/[\\/].+?$/, ''), shell: true });
		process.stdin.write(script);
		if (out) process.stdout.on('data', data => out(data.toString()));
		process.stdin.end();
		return true;
	}
	return false;
}