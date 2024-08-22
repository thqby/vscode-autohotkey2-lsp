/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/

// Compile to cli
const nodeCLIConfig = /** @type WebpackConfig */ {
	context: path.join(__dirname, 'server'),
	mode: 'none',
	target: 'node',
	entry: {
		cli: './cli/cli.ts',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'server', 'cli', 'dist'),
		libraryTarget: 'commonjs',
	},
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {},
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
module.exports = [nodeCLIConfig];
