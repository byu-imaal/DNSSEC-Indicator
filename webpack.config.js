const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const WebpackImagesResizer = require('webpack-images-resizer')

const files = ['default', 'loading', 'secure', 'insecure', 'bogus']
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
	resizers.push(new WebpackImagesResizer(images, {width: size, height: size}))
})

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
		}),
        ...resizers,
	],
	optimization: {
        minimize: false
    },
}