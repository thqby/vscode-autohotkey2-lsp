import * as assert from 'assert';
import { LanguageClient } from 'vscode-languageclient/node';
import { getClient } from './utils';
import { before, test } from 'mocha';

let client: LanguageClient;
before(async () => {
	client = (await getClient()) as LanguageClient;
});

// todo copy from ahkpp
test('should be running', () => {
	assert.equal(client?.isRunning(), true);
	// open a file

	// trigger a suggestion

	// ensure that the right files are excluded
});
