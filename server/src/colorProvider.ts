import { CancellationToken, ColorInformation, ColorPresentation, ColorPresentationParams, DocumentColorParams } from 'vscode-languageserver';
import { Maybe, lexers } from './common';

export async function colorPresentation(params: ColorPresentationParams, token: CancellationToken): Promise<Maybe<ColorPresentation[]>> {
	const { range, color, textDocument: { uri } } = params, text = lexers[uri.toLowerCase()]?.document.getText(range);
	if (!text || token.isCancellationRequested) return;
	const pre = /^0x/.test(text) ? '0x' : '', A = text.length - (pre ? 2 : 0) > 6 ? 'A' : '';
	let colors: number[] | string[] =[color.red, color.green, color.blue];
	A && colors.unshift(color.alpha);
	colors = colors.map(v => `0${Math.round(v * 255).toString(16)}`.slice(-2));
	colors = [colors.join(''), colors.reverse().join('')];
	return [{
		label: `${A}RGB: ${colors[0]}`,
		textEdit: { range, newText: `${pre}${colors[0]}` }
	}, {
		label: `BGR${A}: ${colors[1]}`,
		textEdit: { range, newText: `${pre}${colors[1]}` }
	}];
}

export async function colorProvider(params: DocumentColorParams, token: CancellationToken): Promise<Maybe<ColorInformation[]>> {
	if (!token.isCancellationRequested)
		return lexers[params.textDocument.uri.toLowerCase()]?.getColors();
}