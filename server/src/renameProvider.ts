import { CancellationToken, PrepareRenameParams, Range, RenameParams, WorkspaceEdit } from 'vscode-languageserver';
import { ResponseError } from 'vscode-jsonrpc';
import { Maybe, lexers, getAllReferences, response } from './common';

let ranges: Record<string, Range[]> | null | undefined;

export async function prepareRename(params: PrepareRenameParams, token: CancellationToken): Promise<Maybe<{ range: Range, placeholder: string } | ResponseError>> {
	const lex = lexers[params.textDocument.uri.toLowerCase()];
	if (!lex || token.isCancellationRequested) return;
	const context = lex.getContext(params.position);
	if ((ranges = getAllReferences(lex, context, false)))
		return { range: context.range, placeholder: context.text.split('.').pop() || '' };
	return new ResponseError(0, ranges === null ? response.cannotrenamestdlib() : response.cannotrename());
}

export async function renameProvider(params: RenameParams, token: CancellationToken): Promise<Maybe<WorkspaceEdit>> {
	if (token.isCancellationRequested) return;
	const result: WorkspaceEdit = { changes: {} }, newText = params.newName;
	for (const uri in ranges)
		result.changes![uri] = ranges[uri].map(range => ({ range, newText }))
	return result;
}