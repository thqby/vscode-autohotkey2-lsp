// https://github.com/microsoft/vscode-test-cli
import { defineConfig } from '@vscode/test-cli';
export default defineConfig({ files: 'out/test/**/*.test.js' });