const path = require('path')

module.exports = function () {
  return {
    entry: {
      JSVizHelper: './visuals/JSVizHelper.js',
      JSVizImageViewer: './visuals/JSVizImageViewer.js',
      JSVizRadarChart: './visuals/JSVizRadarChart.js',
      JSVizWordCloud: './visuals/JSVizWordCloud.js',
      JSVizNetwork: './visuals/JSVizNetwork.js',
      JSVizSankey: './visuals/JSVizSankey.js',
      JSVizSunburst: './visuals/JSVizSunburst.js',
      JSVizAnimateData: './visuals/JSVizAnimateData.js',
      JSVizJustGage: './visuals/JSVizJustGage.js',
      JSVizBulletList: './visuals/JSVizBulletList.js'
    },
    output: {
      // eslint-disable-next-line no-undef
      path: path.resolve(__dirname, '../dist'),
      filename: '[name].min.js'
    },
    module: {
      rules: [
        { // We want to lint all files in our js folder
          test: /\.js$/,
          // eslint-disable-next-line no-undef
          include: [ path.resolve(__dirname, '../visuals'), path.resolve(__dirname, '../lib') ],
          loader: 'eslint-loader',
          options: {
            failOnError: true
          }
        },
        { test: /\.css$/, loader: 'style-loader!css-loader' }, // Support packing style sheets
        { test: /\.(png|jpd)$/, loader: 'url-loader' }, // Inline all images
        { test: path.resolve('vendor'), loader: 'script-loader' }, // JSViz isn't a module, so load as a script
        { // jQuery needs to be exposed to the window variable, otherwise JSViz.js won't work
          test: require.resolve('jquery'),
          use: [
            {
              loader: 'expose-loader',
              query: 'jQuery'
            },
            {
              loader: 'expose-loader',
              query: '$'
            }
          ]
        }
      ]
    }
  }
}
