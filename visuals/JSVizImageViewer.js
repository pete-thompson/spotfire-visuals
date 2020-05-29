// Very simple visualisation to display an image from a URL

var $ = require('jquery')
var JSVizHelper = require('../lib/JSVizHelper.js')
require('imagesloaded')

var defaultConfig = {
  markingBorderWidth: 5,
  markingBorderColor: 'blue',
  imageStyle: ''
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  render: render,
  mark: {
    selector: '#js_chart img',
    type: JSVizHelper.markType.rect
  },
  configuratorTitle: 'Image Viewer options',
  configOptions: [
    {
      caption: "CSS Style applied to each image (e.g. 'height: 100px; width 100px;' to create 100x100 thumbnails)",
      type: 'text',
      name: 'imageStyle',
      inputAttributes: {
        size: 30
      }
    },
    {
      caption: 'Marking border width in pixels',
      type: 'number',
      name: 'markingBorderWidth',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    },
    {
      caption: 'Marking border colour',
      type: 'color',
      name: 'markingBorderColor'
    }
  ]
})

//
// This is the main drawing method
//
function render (data, config) {
  // Clear out any existing images
  $('#js_chart div').remove()

  // Add an image for each data row
  data.data.forEach(function (dataRow) {
    if (dataRow.items.length > 0) {
      // Put all the images inside DIVs that can be used for marking borders
      var div = $('<div>').css({ overflow: 'hidden', float: 'left' }).appendTo('#js_chart')
      var img = $('<img>', {
        src: dataRow.items[0],
        'data-id': dataRow.hints.index,
        style: config.imageStyle
      }).appendTo(div)
        .imagesLoaded(function () {
        // We can only do this once the image loads, otherwise the width/height return 0
          if (dataRow.hints.marked) {
          // We want a border, but over the top of the image rather than outside it  (we don't want the image to get bigger)
            var borderWidthPx = config.markingBorderWidth
            var borderColor = config.markingBorderColor
            div.css({
              width: (img.outerWidth(true) - 2 * borderWidthPx) + 'px',
              height: (img.outerHeight(true) - 2 * borderWidthPx) + 'px',
              border: 'solid ' + borderWidthPx + 'px ' + borderColor
            })
            img.css({
              top: -1 * borderWidthPx + 'px',
              left: -1 * borderWidthPx + 'px',
              position: 'relative'
            })
          }
        })
    }
  })
}
