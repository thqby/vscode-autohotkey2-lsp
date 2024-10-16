/** The regular expressions to check for exclusion */
export interface ScanExclude {
	file: RegExp[];
	folder: RegExp[];
}

export const globalScanExclude: ScanExclude = { file: [], folder: [] };

/**
 * Returns whether the provided path should be excluded from scanning based on its name.
 * Assumes the path is already resolved.
 */
export const shouldExclude = (
	path: string,
	/** Folder only will check only the folder patterns in the provided exclude object */
	options: 'folderOnly' | 'all' = 'all',
	/** The patterns to use for exclusion testing. Defaults to global patterns, matching user settings */
	exclude: ScanExclude = globalScanExclude,
): boolean => {
	if (exclude.folder.some((re) => re.test(path))) {
		return true;
	}
	if (options === 'all' && exclude.file.some((re) => re.test(path))) {
		return true;
	}
	return false;
};
