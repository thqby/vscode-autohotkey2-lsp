import { openFile } from '../src/common';
import { Lexer } from '../src/lexer';

function main() {
	const options: Record<string, string> = {};
	process.argv.slice(2).forEach((s) => {
		const arr = s.split('=');
		options[arr[0]] = arr[1].replace(/^(['"])(.*)\1$/, '$2');
	});
	const path: string = options.path ?? '';
	if (!path) return;
	try {
		const td = openFile(path, false);
		if (!td) return;
		const sc = new Lexer(td).beautify(options);
		console.log(sc);
	} catch (e) {
		console.error(e);
	}
}

main();
