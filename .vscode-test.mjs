// https://github.com/microsoft/vscode-test-cli
import { defineConfig } from '@vscode/test-cli';
import { execSync } from 'child_process';

let timeout, vscode_path;
if (process.execPath.toLowerCase().endsWith('code.exe'))
	timeout = 0;
else {
	try {
		const m = execSync('chcp 65001 && reg query HKCR\\vscode\\shell\\open\\command', { encoding: 'utf8' })
			.match(/REG_SZ\s+("([^"]+)"|\S+)/);
		vscode_path = m[2] || m[1];
	} catch { }
}

export default defineConfig({
	files: 'client/dist/test/**/*.test.js',
	mocha: {
		failZero: true,
		timeout
	},
	useInstallation: vscode_path && {
		fromPath: vscode_path
	}
});