import { CancellationToken, Hover, HoverParams, SymbolKind } from 'vscode-languageserver';
import {
	AhkSymbol, FuncNode, Maybe, SemanticTokenTypes, Variable,
	get_detail, hoverCache, join_types, lexers, find_symbols
} from './common';

export async function hoverProvider(params: HoverParams, token: CancellationToken): Promise<Maybe<Hover>> {
	if (token.isCancellationRequested) return;
	const uri = params.textDocument.uri.toLowerCase(), lex = lexers[uri];
	const context = lex?.getContext(params.position), hover: { kind?: 'ahk2', value: string }[] = [];
	let t;
	if (!context)
		return;
	if (context.kind === SymbolKind.Null) {
		if (context.token.semantic?.type !== SemanticTokenTypes.variable) {
			t = context.token;
			if ((t = hoverCache[(t.hover_word || t.content).toLowerCase()]))
				return t[1];
		}
		return;
	}
	let nodes = find_symbols(lex, context);
	if (!nodes?.length)
		return;
	const set = [] as AhkSymbol[];
	nodes = nodes.filter(it => !set.includes(it.node) && set.push(it.node));
	if (nodes.length > 1) {
		for (t of nodes)
			(t = (t.node as FuncNode).full) && hover.push({ kind: 'ahk2', value: t });
	} else {
		const { node, is_global, uri } = nodes[0], fn = node as FuncNode;
		if (node.kind === SymbolKind.Class && !fn.full?.startsWith('('))
			hover.push({ kind: 'ahk2', value: 'class ' + (fn.full || node.name) });
		else if (fn.full) {
			hover.push({ kind: 'ahk2', value: fn.full });
			let overloads = fn.overloads;
			switch (typeof overloads) {
				case 'object':
					overloads = overloads.map(it => it.full).join('\n');
				// fallthrough
				case 'string':
					if (fn.name)
						overloads = overloads.replace(/^(\w|[^\x00-\x7f])+/gm,
							fn.full.substring(0, fn.full.search(/(?!^)[([]/)));
					hover.at(-1)!.value += `\n${overloads}`;
					break;
			}
		}

		let md = get_detail(node, lexers[uri]);
		if (typeof md === 'string')
			md = md && ('```plaintext\n' + md + '\n```');
		else md = md.value;
		if ((node as Variable).is_param) {
			if (!md.startsWith('*@param* '))
				md = `*@param* \`${node.name}\`${(t = join_types(node.type_annotations)) && `: *\`${t}\`*`}\n___\n${md}`;
			else md = md.replace(/\n|(?<=`\*?) — /, '\n___\n');
		} else if (node.kind === SymbolKind.Variable) {
			const kind = is_global === true ? '*@global*' : node.static ? '*@static*' : '*@local*';
			md = `${kind} \`${node.name}\`${(t = join_types(node.type_annotations)) && `: *\`${t}\`*`}\n___\n${md}`;
		} else if (node.kind === SymbolKind.Property && hover.length && (t = join_types(node.type_annotations)))
			hover[0].value += `: ${t}`;
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