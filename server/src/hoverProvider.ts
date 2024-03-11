import { CancellationToken, Hover, HoverParams, SymbolKind } from 'vscode-languageserver';
import {
	AhkSymbol, FuncNode, Maybe, SemanticTokenTypes, Variable,
	format_markdown_detail, hoverCache, join_types, lexers, find_symbols
} from './common';

export async function hoverProvider(params: HoverParams, token: CancellationToken): Promise<Maybe<Hover>> {
	if (token.isCancellationRequested) return;
	let uri = params.textDocument.uri.toLowerCase(), lex = lexers[uri];
	let context = lex?.getContext(params.position), hover: { kind?: 'ahk2', value: string }[] = [], t;
	if (!context)
		return;
	if (context.kind === SymbolKind.Null) {
		if (context.token.semantic?.type !== SemanticTokenTypes.variable) {
			t = context.token;
			if (t = hoverCache[(t.hover_word || t.content).toLowerCase()])
				return t[1];
		}
		return;
	}
	let nodes = find_symbols(lex, context);
	if (!nodes?.length)
		return;
	let set = [] as AhkSymbol[];
	nodes = nodes.filter(it => !set.includes(it.node) && set.push(it.node));
	if (nodes.length > 1) {
		for (t of nodes)
			(t = (t.node as FuncNode).full) && hover.push({ kind: 'ahk2', value: t });
	} else {
		let { node, is_global, uri } = nodes[0], fn = node as FuncNode;
		if (node.kind === SymbolKind.Class && !fn.full?.startsWith('('))
			hover.push({ kind: 'ahk2', value: 'class ' + (fn.full || node.name) });
		else if (fn.full)
			hover.push({ kind: 'ahk2', value: fn.full });

		let md = format_markdown_detail(node, lexers[uri]), re = /^/, ___re = / — |  \n|\n\n/, t;
		if ((node as Variable).is_param) {
			if (!md.startsWith('*@param* '))
				md = `*@param* \`${node.name}\`${(t = join_types(node.type_annotations)) && `: *\`${t}\`*`}\n___\n${md}`;
			else md = md.replace(___re, '\n___\n');
		} else if (node.kind === SymbolKind.Variable) {
			if (md.startsWith('*@var* ')) {
				md = md.replace(___re, '\n___\n');
				re = /^\*@var\*\s/;
			} else if (md.startsWith('*@type* '))
				md = md.replace(___re, '\n___\n').replace(/^\*@type\*[ \t]*/, `\`${node.name}\`: `);
			else
				md = `\`${node.name}\`${(t = join_types(node.type_annotations)) && `: *\`${t}\`*`}\n___\n${md}`;
			md = md.replace(re, is_global === true ? '*@global* ' : node.static ? '*@static* ' : '*@local* ');
		}
		md && hover.push({ value: (hover.length ? '___\n' : '') + md });
	}
	return {
		contents: {
			kind: 'markdown',
			value: hover.map(it => it.kind === 'ahk2' ?
				'```ahk2\n' + it.value + '\n```' : it.value).join('\n\n')
		}
	};
}