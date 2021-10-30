/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
	target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

	entry: {
		'client/dist/extension': './client/src/extension.ts',
		'server/dist/server': './server/src/server.ts'
	}, // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
	output: { // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: __dirname,
		filename: '[name].js',
		libraryTarget: "commonjs",
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	devtool: 'source-map',
	externals: {
		vscode: "commonjs vscode" // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
	},
	resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
		extensions: ['.ts', '.js'],
		fallback: {
			http: false
		}
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader',
				options: {
					compilerOptions: {
						"module": "es6" // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
					}
				}
			}]
		}]
	},
}


const browserClientConfig = /** @type WebpackConfig */ {
	context: path.join(__dirname, 'client'),
	mode: 'none',
	target: 'webworker', // web extensions run in a webworker context
	entry: {
		browserClientMain: './src/browserClientMain.ts',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'client', 'dist'),
		libraryTarget: 'commonjs',
	},
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {},
		fallback: {
			path: require.resolve('path-browserify'),
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'source-map',
};

const browserServerConfig = /** @type WebpackConfig */ {
	context: path.join(__dirname, 'server'),
	mode: 'none',
	target: 'webworker', // web extensions run in a webworker context
	entry: {
		browserServerMain: './src/browserServerMain.ts',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'server', 'dist'),
		libraryTarget: 'var',
		library: 'serverExportVar',
	},
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {},
		fallback: {
			fs: false,
			path: require.resolve("path-browserify"),
			process: false
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'source-map'
};

module.exports = [config, browserClientConfig, browserServerConfig];