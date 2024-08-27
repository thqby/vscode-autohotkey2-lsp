import { resolve } from 'path';
import * as Mocha from 'mocha';
import { readdir } from 'fs';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		timeout: 0
	});

	return new Promise((c, e) => {
		readdir(__dirname, (err, files) => {
			if (err) {
				return e(err);
			}

			// Add files to the test suite
			files.forEach(f => f.endsWith('.test.js') && mocha.addFile(resolve(__dirname, f)));

			try {
				// Run the mocha test
				mocha.run(failures => {
					if (failures > 0) {
						e(new Error(`${failures} tests failed.`));
					} else {
						c();
					}
				});
			} catch (err) {
				console.error(err);
				e(err);
			}
		});
	});
}