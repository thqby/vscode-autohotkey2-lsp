import { createClientSocketTransport, createMessageConnection, createServerSocketTransport, MessageConnection } from 'vscode-languageserver/node';
import { spawn } from 'child_process';
import { ahkpath_resolved, rootdir } from './common';
let ahk_server: MessageConnection | undefined | null;

async function get_ahkProvider_port(): Promise<number> {
	// eslint-disable-next-line no-async-promise-executor
	return new Promise(async resolve => {
		if (!ahkpath_resolved)
			return resolve(0);
		let server, port = 1200;
		while (true) {
			try {
				server = await createClientSocketTransport(port);
				break;
			} catch (_) {
				port++;
			}
		}
		const process = spawn(ahkpath_resolved, [`${rootdir}/server/dist/ahkProvider.ahk`, port.toString()]);
		if (!process.pid)
			return resolve(0);
		let resolve2: ((_?: MessageConnection) => void) | undefined = (r?: MessageConnection) => {
			resolve2 = undefined;
			if (!r) return resolve(0);
			r.onNotification('initialized', (port) => (r.dispose(), resolve(port)));
			r.listen();
		};
		process.on('close', () => resolve2?.());
		server.onConnected().then(
			m => resolve2?.(createMessageConnection(...m)),
			() => resolve2?.()
		);
	});
}

export async function get_ahkProvider(): Promise<MessageConnection | null> {
	if (ahk_server !== undefined)
		return ahk_server;
	let port = 0;
	if (!process.env.BROWSER && process.platform === 'win32')
		port = await get_ahkProvider_port();
	if (!port)
		return ahk_server = null;
	return new Promise(resolve => {
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