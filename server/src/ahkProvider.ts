import { createClientSocketTransport, createMessageConnection, createServerSocketTransport, MessageConnection } from 'vscode-languageserver/node';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { type } from 'os';
import { ahkpath_cur, rootdir, extsettings } from './common';
let ahk_server: MessageConnection | undefined | null;

async function get_ahkProvider_port(): Promise<number> {
	return new Promise(async (resolve, reject) => {
		let executePath = ahkpath_cur || extsettings.InterpreterPath;
		if (!existsSync(executePath))
			return resolve(0);
		let server, port = 1200;
		while (true) {
			try {
				server = await createClientSocketTransport(port);
				break;
			} catch (e) {
				port++;
			}
		}
		let process = spawn(executePath, [`${rootdir}/dist/ahkProvider.ahk`, port.toString()]);
		if (!process || !process.pid)
			return resolve(0);
		let resolve2: any = (r?: MessageConnection) => {
			resolve2 = undefined;
			if (!r) return resolve(0);
			r.onNotification('initialized', (port) => (r.dispose(), resolve(port)));
			r.listen();
		};
		process.on('close', () => resolve2 && resolve2(null));
		server.onConnected().then(
			m => resolve2 && resolve2(createMessageConnection(...m)),
			_ => resolve2 && resolve2(null)
		);
	});
}

export async function get_ahkProvider(): Promise<MessageConnection | null> {
	if (ahk_server !== undefined)
		return ahk_server;
	let port = 0;
	if (type() === 'Windows_NT')
		port = await get_ahkProvider_port();
	if (!port)
		return ahk_server = null;
	return new Promise((resolve, reject) => {
		let init = false;
		ahk_server = createMessageConnection(...createServerSocketTransport(port));
		ahk_server.onNotification('initialized', () => {
			init = true;
			resolve(ahk_server ?? (ahk_server = undefined, null));
		});
		ahk_server.onClose(() => ahk_server = undefined);
		ahk_server.listen();
		setTimeout(() => {
			if (!init)
				ahk_server?.dispose(), resolve(ahk_server = null);
		}, 500);
	});
}