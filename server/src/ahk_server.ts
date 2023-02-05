import { createClientSocketTransport, createMessageConnection, MessageConnection } from 'vscode-languageserver/node';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { ahkpath_cur, dirname, extsettings } from './common';
let ahk_server: MessageConnection | undefined | null;

async function start_ahk_server() {
	return new Promise(async (resolve, reject) => {
		if (ahk_server !== undefined)
			return resolve(ahk_server);
		let executePath = ahkpath_cur || extsettings.InterpreterPath;
		if (!existsSync(executePath))
			return resolve(undefined);
		let server, port = 1200;
		while (true) {
			try {
				server = await createClientSocketTransport(port);
				break;
			} catch (e) {
				port++;
			}
		}
		let process = spawn(executePath, [dirname.replace(/\\server\\\w+$/, '\\server\\dist\\') + 'ahk_server.ahk', port.toString()]);
		if (!process || !process.pid)
			return resolve(undefined);
		let res: any = (r?: MessageConnection) => {
			r && r.listen();
			resolve(r);
		};
		process.on('close', () => res ? (res(null), res = undefined) : (ahk_server = undefined));
		server.onConnected().then(
			m => res && (res(createMessageConnection(...m), res = undefined)),
			_ => res && (res(null), res = undefined)
		);
	});
}

export async function send_ahk_Request(method: string, params: string[]) {
	if (ahk_server === undefined)
		ahk_server = await start_ahk_server() as MessageConnection;
	if (!ahk_server)
		return Promise.resolve(null);
	return ahk_server.sendRequest(method, ...params);
}