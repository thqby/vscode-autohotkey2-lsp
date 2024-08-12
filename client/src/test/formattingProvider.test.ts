import { getDocument, sleep } from '../test/utils';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const inFilenameSuffix = '.in.ahk2';
const outFilenameSuffix = '.out.ahk2';
interface FormatTest {
	/** Name of the file, excluding the suffix (@see inFilenameSuffix, @see outFilenameSuffix) */
	filenameRoot: string;
}

// Currently in `out` folder, need to get back to main `src` folder
// * this path changes if you import from the server folder
const filesParentPath = path.join(
	__dirname, // client/dist/test
	'..', // client/dist
	'..', // client
	'src', // client/src
	'test', // client/src/test
	'samples', // client/src/test/samples
);

suite('External formatter', () => {
	const externalFormatTests: FormatTest[] = [{ filenameRoot: '0-format' }];

	externalFormatTests.forEach((formatTest) => {
		test(`${formatTest.filenameRoot} external format`, async () => {
			// Arrange
			const inFilename = formatTest.filenameRoot + inFilenameSuffix;
			const outFilename = formatTest.filenameRoot + outFilenameSuffix;
			const outFileString = fs
				.readFileSync(path.join(filesParentPath, outFilename))
				.toString();
			const unformattedSampleFile = await getDocument(
				path.join(filesParentPath, inFilename),
			);
			const originalText = unformattedSampleFile.getText();
			const textEditor = await vscode.window.showTextDocument(
				unformattedSampleFile,
			);
			let eventFired = false;
			const formattingPromise = new Promise<void>((resolve) => {
				const disposable = vscode.workspace.onDidChangeTextDocument(
					(event) => {
						if (event.document === textEditor.document) {
							eventFired = true;
							disposable.dispose();
							resolve();
						}
					},
				);
			});

			// Act
			while (!eventFired) {
				await vscode.commands.executeCommand(
					'editor.action.formatDocument',
				);
				await sleep(50);
			}
			await formattingPromise;

			// Assert
			assert.strictEqual(textEditor.document.getText(), outFileString);

			// Teardown - revert the file to its original state
			const lastLineIndex = unformattedSampleFile.lineCount - 1;
			const lastLineLength =
				unformattedSampleFile.lineAt(lastLineIndex).text.length;
			const fullDocumentRange = unformattedSampleFile.validateRange(
				new vscode.Range(
					new vscode.Position(0, 0),
					new vscode.Position(lastLineIndex + 1, lastLineLength + 1), // + 1 to ensure full coverage
				),
			);

			// editing the file also saves the file
			await textEditor.edit((editBuilder) =>
				editBuilder.replace(fullDocumentRange, originalText),
			);

			// Close opened file
			await vscode.commands.executeCommand(
				'workbench.action.closeActiveEditor',
			);
		});
	});
});
