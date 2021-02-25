// Helper library to simplify implementation of new visualisations

// Require this library, then call the SetupViz method passing in an object that defines the visualisation:

// {
//    defaultConfig: an object containing configuration value defaults (name/value)
//    configButton: either configButton.textLeft or configButton.gearRight (defaults to textLeft)
//    render: a function that will be called when the viz is to be rendered, parameters are the data from spotfire and a configuration object where the default has been combined with the values from Spotfire
//    firstTimeSetup: a function that will be called the first time a viz is to be rendered, same parameters as render
//    renderOnResize: true to indicate that the render method should be called whenever the window is resized
//    mark: either a function that conforms to the JSViz markModel signature, or an object defining selection using one of the pre-built methods:
//                      { selector: jQuery selector for objects of interest, type: the algorithm, ignoreClicks: ignore click events for marking }
//                algorithms (which all rely on attaching the Spotfire row hint to the element's "data-id" attribute) are:
//                  markType.rect - simple HTML rectangle intersection - selector identifies all elements that will be checked for rectangle intersection
//                  markType.svg  - svg intersection detection (deals with any shape) - selector should be the svg element itself - note that there is a webkit bug meaning that Safari and Chrome match based on bounding boxes rather than on the actual drawing content
//    configuratorTitle: the title shown when the configurator dialog is shown
//    configuratorInstructions: instructions shown in the configurator dialog
//    configOptions: an array of objects defining the various configuration options. Each object of the form:
//          {
//              tab: "The tab description if using tabs",
//              caption: "The caption displayed for this option",
//              type: "The input type - either text, number, color, checkbox, select, column (for a column picker), multiline",
//              name: "The name of the configuration option - used to populate the configuration JSON for JSViz",
//              valueIfChecked: "Value for a checked checkbox",
//              valueIfUnchecked: "Value for an unchecked checkbox"
//              options: an array of objects defining what appears in a drop down selector (each object has a text property and a value property)
//              enabledIfChecked: If provided, this control will only be enabled if the associated checkbox is checked (reference the checkbox by name)
//              disabledIfChecked: If provided, this control will only be enabled if the associated checkbox is unchecked (reference the checkbox by name)
//          }
// }

var $ = require('jquery')
var JSVizConfigurator = require('./JSVizConfigurator.js')
require('../vendor/JSViz.js')
var _ = require('underscore')

var vizInfo
var firstTime = true
var lastData
var lastConfig
var markingSetup = false
var currentMarkingTimeout
var currentMarkData
var messageDiv

// constants for marking types
exports.markType = {
  rect: 'rect',
  svg: 'svg',
  none: 'none'
}

exports.configButton = JSVizConfigurator.configButton

// Call this to setup your visualisation to use the helper
exports.SetupViz = function (info) {
  var defaults = { defaultConfig: {}, configButton: exports.configButton.textLeft, mark: exports.markType.none, configOptions: [], configuratorTitle: '', configuratorInstructions: '', renderOnResize: false }
  vizInfo = {}
  _.extend(vizInfo, defaults, info)
}

// The renderCore method is called by the JSViz script. Here we do some standard things and then call the visualisation code to actually render
window.renderCore = function (data) {
  exports.pushBusy('JSVIZHelper.rendercore')

  // Used to check if a color is transparent - that way we can keep walking up the parents to find a real color
  function isTransparent (color) {
    switch ((color || '').replace(/\s+/g, '').toLowerCase()) {
      case 'transparent':
      case '':
      case 'rgba(0,0,0,0)':
        return true
      default:
        return false
    }
  }

  try {
    // Get the current configuration
    var config = {}
    _.extend(config, vizInfo.defaultConfig, data.config)

    // Ensure that any numeric options are stored as numbers (e.g. if user has edited config and passed a string)
    vizInfo.configOptions.forEach(function (option) {
      if (option.type === 'number') {
        config[option.name] = +config[option.name]
      }
    })

    if (firstTime) {
      firstTime = false

      // Allow viz to do any first time stuff first in case it needs to adjust things like the default config
      if (typeof vizInfo.firstTimeSetup === 'function') {
        vizInfo.firstTimeSetup(data, config)
      }

      // Setup the configurator
      JSVizConfigurator.SetupConfigurator(vizInfo.configuratorTitle, vizInfo.configuratorInstructions, vizInfo.configOptions, config, vizInfo.defaultConfig, data.static, vizInfo.configButton)

      // Place holder for any message
      messageDiv = $('<div>')
        .appendTo('body')
        .css('width', '100%')
        .css('height', '100%')
        .css('display', 'none')
        .css('position', 'fixed')
        .css('z-index', '2')

      $('<div>')
        .css('width', '100%')
        .css('height', '100%')
        .css('display', 'flex')
        .css('align-items', 'center')
        .css('justify-content', 'center')
        .appendTo(messageDiv)
    }

    // Set the columns since they may change during Setup
    JSVizConfigurator.SetColumns(vizInfo.configOptions, -1, data.columns)
    _.each(data.additionalTables, function (element, key) { JSVizConfigurator.SetColumns(vizInfo.configOptions, key, element.columns) })

    // Set the current values since they could have been edited using the JSON editor
    JSVizConfigurator.SetConfig(vizInfo.configOptions, data.config, vizInfo.defaultConfig)

    // Apply the right style to the body element
    $('body').attr('style', data.style)

    // Stop regular text selection
    $('body').css('-webkit-user-select', 'none').css('-moz-user-select', 'none').css('-ms-user-select', 'none').css('user-select', 'none')

    // If we're running inside an iframe grab the real background color and apply to our body element
    // This allows our visualisation code to assume that the the background on the body is the one to use when theming backgrounds
    if (window.frameElement) {
      var bc
      var element = $(window.frameElement)
      while (isTransparent(bc = element.css('background-color'))) {
        if (element.is('body')) {
          break
        }
        element = element.parent()
      }
      $('body').css('background-color', bc)
    }

    // Set up our marking implementation
    setupMarking()

    // Hide any previous message
    exports.hideMessage()

    // Call the render method
    lastData = data
    lastConfig = config
    vizInfo.render(data, config)
  } catch (e) {
    console.error(e)
    exports.showMessageInstead('An error occurred: ' + e)
  } finally {
    exports.popBusy('JSVIZHelper.rendercore')
  }
}

// Returns the Marking mode based on what keys are currently being pressed
exports.getMarkMode = function (e) {
  // shift: add rows
  // control: toggle rows
  // none: replace rows
  if (e.shiftKey) {
    return 'Add'
  } else if (e.ctrlKey) {
    return 'Toggle'
  }

  return 'Replace'
}

// Override JSViz's marking behaviour. It causes problems with things like our configuration form, or elements that we want to mark via a click event
window.initMarking = function () { }

// Capture the markIndices method so we can ensure we only call it once
// This handles situations where click events on elements fire as well as our default marking handler
var JSVizMarkIndices = window.markIndices
window.markIndices = function (markData) {
  currentMarkData = markData
  if (!currentMarkingTimeout) {
    currentMarkingTimeout = window.setTimeout(function () {
      JSVizMarkIndices(currentMarkData)
      currentMarkingTimeout = null
    }, 10)
  }
}

// A replacement for JSViz's InitMarking. This one allows us to disable the default behaviour when the form is being shown
function setupMarking () {
  if (!markingSetup) {
    markingSetup = true

    const svgIntersectionSupport = typeof SVGSVGElement.prototype.getIntersectionList === 'function'

    if ((vizInfo.mark === 'none') || (vizInfo.mark.type === 'none')) {
      // Do nothing - no marking
    } else if (vizInfo.mark.type === 'svg' && !svgIntersectionSupport) {
      console.warn('SVG.getIntersectionList not supported - lasso marking not available in this browser')
    } else {
      $('body').on('mousedown', function (mouseDownEvent) {
        if (!JSVizConfigurator.ConfiguratorVisible()) {
          var markMode = exports.getMarkMode(mouseDownEvent)
          //
          // Create initial marking rectangle, will be used if the user only clicks.
          //
          var x = mouseDownEvent.pageX
          var y = mouseDownEvent.pageY
          var width = 1
          var height = 1

          var $selection = $('<div/>').css({
            position: 'absolute',
            border: '1px solid #0a1530',
            'background-color': '#8daddf',
            opacity: '0.5'
          }).hide().appendTo(this)

          $(this).on('mousemove', function (mouseMoveEvent) {
            x = Math.min(mouseDownEvent.pageX, mouseMoveEvent.pageX)
            y = Math.min(mouseDownEvent.pageY, mouseMoveEvent.pageY)
            width = Math.abs(mouseDownEvent.pageX - mouseMoveEvent.pageX)
            height = Math.abs(mouseDownEvent.pageY - mouseMoveEvent.pageY)

            if (width > 5 || height > 5) {
              // We've moved a short distance - stop the browser's regular selection behaviour
              // without this check we tend to lose click events that might be used for marking elsewhere
              mouseMoveEvent.preventDefault()

              $selection.css({
                left: x + 'px',
                top: y + 'px',
                width: width + 'px',
                height: height + 'px'
              })

              $selection.show()
            } else {
              $selection.hide()
            }
          })

          $(this).on('mouseup', function () {
            // We force the rectangle to at least occupy a single point so as to allow for clicks
            var rectangle = {
              x: x,
              y: y,
              width: Math.max(width, 1),
              height: Math.max(height, 1)
            }

            try {
              if (!vizInfo.mark.ignoreClicks || width > 1 || height > 1) {
                doMarking(markMode, rectangle)
              }
            } finally {
              // Make sure we always close the rectangle
              $selection.remove()
              $(this).off('mouseup mousemove')
            }
          })
        }
      })
    }
  }
}

// Find the data that needs to be marked based on the rectangle
function doMarking (markMode, rectangle) {
  function addElementToMarking (node) {
    // Grab the id of the item and add to the items to mark
    var dataId = $(node).attr('data-id')
    if (dataId) {
      markData.indexSet.push(dataId)
    }
    var dataIds = $(node).attr('data-id-array')
    if (dataIds) {
      JSON.parse(dataIds).forEach(function (x) { markData.indexSet.push(x) })
    }
  }

  if (typeof vizInfo.mark === 'function') {
    vizInfo.mark(markMode, rectangle)
  } else if (vizInfo.mark !== 'none') {
    var markData = { markMode: markMode, indexSet: [] }

    // Find all the matching elements
    if (vizInfo.mark.type === exports.markType.rect) {
      $(vizInfo.mark.selector).filter(function (index) {
        // That are inside the rectangle
        var offset = $(this).offset()
        if ((offset.left + $(this).width() < rectangle.x) ||
        (rectangle.x + rectangle.width < offset.left) ||
        (offset.top + $(this).height() < rectangle.y) ||
        (rectangle.y + rectangle.height < offset.top)) {
          return false
        } else {
          return true
        }
      }).each(function (i, d) { addElementToMarking(d) })
    } else if (vizInfo.mark.type === exports.markType.svg) {
      $(vizInfo.mark.selector).each(function () {
        // Use this SVG, figure out it's position on the page and create a rectangle object to check intersection
        var svg = this
        if (typeof svg.getIntersectionList !== 'function') {
          console.warn('SVG.getIntersectionList not supported - lasso marking not available in this browser')
        } else {
          var offset = $(svg).offset()
          var svgRect = svg.createSVGRect()
          svgRect.x = rectangle.x - offset.left
          svgRect.y = rectangle.y - offset.top
          svgRect.width = rectangle.width
          svgRect.height = rectangle.height
          var nodes = svg.getIntersectionList(svgRect, null)
          // IE doesn't support foreach on a  NodeList, so small hack here
          Array.prototype.forEach.call(nodes, addElementToMarking)
        }
      })
    }
    markData.indexSet = _.uniq(markData.indexSet)
    window.markIndices(markData)
  }
}

// Convert the data as sent from JSViz into an array of objects using column names as object keys
// We also store the marked flag in a column called '_marked' and the hint index in '_index'
exports.DataMarkedColumn = '_marked'
exports.DataIndexColumn = '_index'
exports.DataAsNamedArray = function (data, includeSpecialColumns) {
  var chartData = []
  data.data.forEach(function (dataRow) {
    if (dataRow.items.length > 0) {
      var newRow = {}
      data.columns.forEach(function (column, index) {
        newRow[column] = dataRow.items[index]
      })
      if (includeSpecialColumns) {
        newRow[exports.DataMarkedColumn] = dataRow.hints.marked
        newRow[exports.DataIndexColumn] = dataRow.hints.index
      }
      chartData.push(newRow)
    }
  })

  return chartData
}

// Handle window resizing
window.onresize = function () {
  if (!firstTime && vizInfo.renderOnResize) {
    vizInfo.render(lastData, lastConfig)
  }
}

// Support busy/idle
// Call the pushBusy function whenever you start being busy and popBusy when the associated activity completes
// The functions optionally take a parameter allowing specific operations to be tracked - you can push the same activity as many times as you like, but popping it will clear the busy indicator for that activity immediately
// Hence we support simple push/pop with counting (e.g. when creating lots of transitions - push when each starts, pop when each ends) or push/pop of specific actions
// We'll track when to call the setBusy function - we'll only clear the busy flag once all activities are completed
// By default, the render method automatically pushes and pops an activity - so there's no need to call these methods unless more complex handling is required (e.g. animations)
var busyCount = 0
var busyTracker = {}
exports.pushBusy = function (id) {
  if (busyCount === 0) window.setBusy(true)
  if (id) {
    if (!busyTracker[id]) {
      busyTracker[id] = true
      busyCount++
    }
  } else {
    busyCount++
  }
}

exports.popBusy = function (id) {
  if (id) {
    if (busyTracker[id]) {
      busyTracker[id] = false
      busyCount--
    }
  } else {
    busyCount--
  }
  if (busyCount === 0) window.setBusy(false)
}

// Helpers for showing messages instead of charts
// Show a message instead of the visualisation
exports.showMessageInstead = function (message) {
  messageDiv.children().html(message)
  messageDiv.css('display', 'block')
  $('#js_chart').css('display', 'none')
}

// Hide the message and allow the chart to show
exports.hideMessage = function () {
  messageDiv.children().html('')
  messageDiv.css('display', 'none')
  $('#js_chart').css('display', 'block')
}
