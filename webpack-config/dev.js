const webpackMerge = require('webpack-merge')

const commonConfig = require('./base.js')

module.exports = function () {
  return webpackMerge(commonConfig(), {
    mode: 'development',
    devtool: 'eval-source-map' // Best quality source maps for development
  })
}
