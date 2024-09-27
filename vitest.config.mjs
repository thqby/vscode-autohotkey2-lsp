import { defineConfig } from 'vitest/config';

// https://vitest.dev/config
// https://vitest.dev/guide/improving-performance.html
export default defineConfig({
	test: {
		isolate: false,
		pool: 'threads',
		coverage: {
			enabled: true,
		},
	},
});
