import { expect, test, describe, vi, beforeAll, afterAll } from 'vitest';
import { resolvePath } from './utils';

describe('resolvePath', () => {
	beforeAll(() => {
		// Mock the behavior of fs.lstatSync
		vi.mock('fs', () => ({
			lstatSync: (_path: string) => ({ isSymbolicLink: () => false }),
		}));
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	test.concurrent.each<
		[
			name: string,
			args: Parameters<typeof resolvePath>,
			expected: ReturnType<typeof resolvePath>,
		]
	>([
		['empty string', [''], ''],
		['absolute path at drive root', ['C:/out.txt'], 'C:/out.txt'],
	])('%s', (_name, args, expected) => {
		const result = resolvePath(...args);
		expect(result).toBe(expected);
	});
});
