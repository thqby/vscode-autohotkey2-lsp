import { CancellationToken, Hover, HoverParams } from 'vscode-languageserver';
import {
	AhkSymbol, ClassNode, FuncNode, Maybe, SemanticTokenTypes, SymbolKind, Variable,
	findSymbols, generateTypeAnnotation, getClassBase, getClassMember, getSymbolDetail,
	hoverCache, joinTypes, lexers
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
	let nodes = findSymbols(lex, context);
	if (!nodes?.length)
		return;
	const set = [] as AhkSymbol[];
	nodes = nodes.filter(it => !set.includes(it.node) && set.push(it.node));
	if (nodes.length > 1) {
		for (t of nodes)
			(t = (t.node as FuncNode).full) && hover.push({ kind: 'ahk2', value: t });
	} else {
		const ll = lexers[nodes[0].uri] ?? lex;
		if ((context.kind === SymbolKind.Method && !context.text || context.token.callsite)) {
			let { node: s, parent: p } = nodes[0];
			if (s.kind === SymbolKind.Class)
				s = getClassMember(ll, p = s, 'call', true) ?? s;
			if (s.full?.startsWith('(Object) static Call(') && (p = (p as ClassNode)?.prototype))
				s = getClassMember(ll, p, '__new', true) ?? s;
			nodes[0].node = s;
		}
		const { node, is_global } = nodes[0], fn = node as FuncNode;
		if (node.kind === SymbolKind.Class && !fn.full?.startsWith('(')) {
			let base: AhkSymbol | undefined = (node as ClassNode).prototype ?? node;
			for (const bs = [base]; base?.full === node.full;)
				if (bs.includes(base = getClassBase(base!, ll)!))
					break;
				else bs.push(base);
			const e = base?.full ? ` extends ${base.full}` : '';
			hover.push({ kind: 'ahk2', value: `class ${(fn.full || node.name)}${e}` });
		} else if (fn.full) {
			if (fn.param_def_len === fn.full.length - fn.full.indexOf('(', fn.name ? 1 : 0))
				fn.full += ` => ${generateTypeAnnotation(fn, ll) || 'void'}`;
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

		let md = getSymbolDetail(node, ll);
		if (typeof md === 'string')
			md = md && ('```plaintext\n' + md + '\n```');
		else md = md.value;
		if ((node as Variable).is_param) {
			if (!md.startsWith('*@param* '))
				md = `*@param* \`${node.name}\`${(t = joinTypes(node.type_annotations)) && `: *\`${t}\`*`}\n___\n${md}`;
			else md = md.replace(/\n|(?<=`\*?) — /, '\n___\n');
		} else if (node.kind === SymbolKind.Variable) {
			const kind = is_global === true ? '*@global*' : node.static ? '*@static*' : '*@local*';
			md = `${kind} \`${node.name}\`${(t = joinTypes(node.type_annotations)) && `: *\`${t}\`*`}\n___\n${md}`;
		} else if (node.kind === SymbolKind.Property) {
			t = node.children ? generateTypeAnnotation(node, ll) : joinTypes(node.type_annotations);
			if (!hover.length) {
				if (!md.startsWith('*@property* '))
					hover.push({ value: `*@property* \`${node.name}\`${t && `: *\`${t}\`*`}` });
			} else if (t)
				hover[0].value += `: ${t}`;
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