import { LibrarySuggestions } from './config.js';

export function includeUserAndStandardLibrary(
	librarySuggestions: LibrarySuggestions,
): boolean {
	return (
		librarySuggestions === LibrarySuggestions.All ||
		librarySuggestions === LibrarySuggestions.UserAndStandard
	);
}

export function includeLocalLibrary(
	librarySuggestions: LibrarySuggestions,
): boolean {
	return (
		librarySuggestions === LibrarySuggestions.All ||
		librarySuggestions === LibrarySuggestions.Local
	);
}
