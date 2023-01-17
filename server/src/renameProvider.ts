import { CancellationToken, PrepareRenameParams, Range, RenameParams, WorkspaceEdit } from 'vscode-languageserver';
import { ResponseError } from 'vscode-jsonrpc';
import { getAllReferences } from './referencesProvider';
import { Maybe, lexers, response } from './common';

let renameranges: { [uri: string]: Range[] } | null | undefined;

export async function prepareRename(params: PrepareRenameParams, token: CancellationToken): Promise<Maybe<{ range: Range, placeholder: string } | ResponseError>> {
	let doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return;
	let context = doc.buildContext(params.position);
	if (renameranges = getAllReferences(doc, context, false))
		return { range: context.range, placeholder: context.text.split('.').pop() || '' };
	return new ResponseError(0, renameranges === null ? response.cannotrenamestdlib() : response.cannotrename());
}

export async function renameProvider(params: RenameParams, token: CancellationToken): Promise<Maybe<WorkspaceEdit>> {
	if (token.isCancellationRequested) return;
	let result: any = { changes: {} }, newText = params.newName;
	for (const uri in renameranges)
		result.changes[uri] = renameranges[uri].map(range => { return { range, newText } })
	return result;
}