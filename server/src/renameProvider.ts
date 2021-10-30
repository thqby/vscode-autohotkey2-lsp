import { PrepareRenameParams, Range, RenameParams, WorkspaceEdit } from 'vscode-languageserver';
import { getAllReferences } from './referencesProvider';
import { Maybe, lexers } from './global';

let renameranges: { [uri: string]: Range[] } | undefined;

export async function prepareRename(params: PrepareRenameParams): Promise<Maybe<{ range: Range, placeholder: string }>> {
	let doc = lexers[params.textDocument.uri.toLowerCase()], context = doc.buildContext(params.position);
	if (renameranges = getAllReferences(doc, context))
		return { range: context.range, placeholder: context.text.split('.').pop() || '' };
}

export async function renameProvider(params: RenameParams): Promise<Maybe<WorkspaceEdit>> {
	let result: any = { changes: {} }, newText = params.newName;
	for (const uri in renameranges)
		result.changes[uri] = renameranges[uri].map(range => { return { range, newText } })
	return result;
}