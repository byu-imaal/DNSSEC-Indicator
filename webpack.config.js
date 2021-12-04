const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
	mode: "production",
	output: {
		filename: "background.js"
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{ from: 'static' }
			]
		})
	],
	optimization: {
        minimize: false
    },
}