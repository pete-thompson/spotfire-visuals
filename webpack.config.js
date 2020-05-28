function buildConfig (env) {
  return require('./webpack-config/' + env + '.js')({ env: env })
}

module.exports = buildConfig
