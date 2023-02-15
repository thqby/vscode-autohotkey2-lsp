import { openFile } from '../src/common';
import { Lexer } from '../src/Lexer';

function main() {
	let options: any = {};
	process.argv.slice(2).forEach(s => {
		let arr = s.split('=');
		options[arr[0]] = arr[1];
	});
	let path: string = options.path ?? '';
	path = path.replace(/^(['"])(.*)\1$/, '$2');
	if (!path)
		return;
	try {
		let td = openFile(path, false);
		if (!td)
			return;
		let sc = new Lexer(td).beautify();
		console.log(sc);
	} catch (e) {
		console.error(e);
	}
}

main()