const fs = require('fs');
const cp = require('child_process');
const ver = 'v' + JSON.parse(fs.readFileSync(__dirname + '/package.json', { encoding: 'utf8' })).version;
cp.exec([
	'git add .',
	`git commit -m ${ver}`,
	`git tag -a ${ver} -m ${ver} -f`,
	`git push origin main --tags`,
].join(' && '), { cwd: __dirname }, (err, stdout, stderr) => {
	if (err)
		return console.error(err);
	stdout && console.log(stdout);
	stderr && console.error(stderr);
});