const webpackMerge = require('webpack-merge')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

const commonConfig = require('./base.js')

module.exports = function () {
  return webpackMerge(commonConfig(), {
    mode: 'production',
    devtool: 'source-map', // Separate .map files that can be served in production as well as development
    optimization: {
      minimizer: [new TerserPlugin({ sourceMap: true })]
    },
    plugins: [
      new CleanWebpackPlugin()
    ]
  })
}
