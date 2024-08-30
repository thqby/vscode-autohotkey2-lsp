import { CancellationToken, PrepareRenameParams, Range, RenameParams, WorkspaceEdit } from 'vscode-languageserver';
import { ResponseError } from 'vscode-jsonrpc';
import { Maybe, lexers, getAllReferences, response } from './common';

let renameranges: Record<string, Range[]> | null | undefined;

export async function prepareRename(params: PrepareRenameParams, token: CancellationToken): Promise<Maybe<{ range: Range, placeholder: string } | ResponseError>> {
	const doc = lexers[params.textDocument.uri.toLowerCase()];
	if (!doc || token.isCancellationRequested) return;
	const context = doc.getContext(params.position);
	if ((renameranges = getAllReferences(doc, context, false)))
		return { range: context.range, placeholder: context.text.split('.').pop() || '' };
	return new ResponseError(0, renameranges === null ? response.cannotrenamestdlib() : response.cannotrename());
}

export async function renameProvider(params: RenameParams, token: CancellationToken): Promise<Maybe<WorkspaceEdit>> {
	if (token.isCancellationRequested) return;
	const result: WorkspaceEdit = { changes: {} }, newText = params.newName;
	for (const uri in renameranges)
		result.changes![uri] = renameranges[uri].map(range => ({ range, newText }))
	return result;
}