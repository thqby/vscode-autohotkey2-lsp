import { openFile } from '../src/common';
import { Lexer } from '../src/Lexer';

function main() {
	const options: { [k: string]: string } = {};
	process.argv.slice(2).forEach((s) => {
		const arr = s.split('=');
		options[arr[0]] = arr[1];
	});
	let path: string = options.path ?? '';
	path = path.replace(/^(['"])(.*)\1$/, '$2');
	if (!path) return;
	try {
		const td = openFile(path, false);
		if (!td) return;
		const sc = new Lexer(td).beautify({});
		console.log(sc);
	} catch (e) {
		console.error(e);
	}
}

main();
