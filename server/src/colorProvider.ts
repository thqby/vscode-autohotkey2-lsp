import { CancellationToken, ColorInformation, ColorPresentation, ColorPresentationParams, DocumentColorParams, TextEdit } from 'vscode-languageserver';
import { Maybe, lexers } from './common';

export async function colorPresentation(params: ColorPresentationParams, token: CancellationToken): Promise<Maybe<ColorPresentation[]>> {
	let label = 'RGB: ', textEdit: TextEdit = { range: params.range, newText: '' }, color = params.color, m: any;
	let text = lexers[params.textDocument.uri.toLowerCase()]?.document.getText(params.range), hex = '';
	if (!text || token.isCancellationRequested) return;
	for (const i of [color.alpha, color.red, color.green, color.blue])
		hex += ('00' + Math.round(i * 255).toString(16)).slice(-2);
	if (m = text.match(/^(0x)?([\da-f]{6}([\da-f]{2})?)/i))
		textEdit.newText = (m[1] || '') + hex.slice(-m[2].length);
	else textEdit.newText = hex.substring(2);
	label += textEdit.newText
	return [{ label, textEdit }];
}

export async function colorProvider(params: DocumentColorParams, token: CancellationToken): Promise<Maybe<ColorInformation[]>> {
	if (!token.isCancellationRequested)
		return lexers[params.textDocument.uri.toLowerCase()]?.colors();
}