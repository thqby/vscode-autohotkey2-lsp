// https://github.com/microsoft/vscode-test-cli
import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
	extensionDevelopmentPath: '..',
	files: 'dist/**/*.test.js',
	version: '1.92.0',
});
