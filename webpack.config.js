const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const WebpackImagesResizer = require('webpack-images-resizer')

const package = require('./package.json')

const mainFile = 'background.js'

const files = ['unsupported', 'secure', 'insecure', 'bogus']
const sizes = [16, 32, 48, 128]

let resizers = []
sizes.forEach(size => {

	let images = []
	files.forEach(file => {
		images.push({
			src: path.resolve(__dirname, `images/${file}.png`),
			dest: `images/${file}/${size}.png`,
		})
	})
	resizers.push(new WebpackImagesResizer(images, { width: size, height: size }))
})

module.exports = {
	mode: 'production',
    output: {
        path: path.resolve(__dirname, 'dist'),
		filename: mainFile,
    },
	plugins: [
		new CleanWebpackPlugin(), // delete dist folder
		new webpack.DefinePlugin({
			__VERSION__: JSON.stringify(package.version),
			__DESCRIPTION__: JSON.stringify(package.description),
		}),
		new CopyWebpackPlugin({
			patterns: [
				// copy version and description from package.json to manifest.json
				{
					from: 'src/manifest.json',
					to: 'manifest.json',
					transform(content, path) {
						// copy-webpack-plugin passes a buffer
						let manifest = JSON.parse(content.toString())

						manifest.version = package.version
						manifest.description = package.description
						manifest.background.service_worker = mainFile

						// pretty print to JSON with tabs
						return JSON.stringify(manifest, null, '\t')
					}
				},
				// copy popup
				{ from: 'static' }
			]
		}),
		...resizers,
	],
	optimization: {
		minimize: process.env.NODE_ENV == 'production'
	},
}