// https://github.com/microsoft/vscode-test-cli
import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
	files: 'dist/test/**/*.test.js',
	version: '1.92.0'
});