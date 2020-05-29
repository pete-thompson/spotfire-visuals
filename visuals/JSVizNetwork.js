// Visualise using a Network Chart

import { event as currentEvent } from 'd3-selection'

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')

var d3 = _.extend({}, require('d3-selection'), require('d3-scale'), require('d3-force'), require('d3-drag'), require('d3-shape'), require('d3-zoom'), require('d3-scale-chromatic'))

var $ = require('jquery')

require('jquery-ui/ui/widgets/button.js')
require('jquery-ui/ui/widgets/dialog.js')
require('jquery-ui/themes/base/all.css')

var svg
var svgG
var parent
var simulation
var color
var shape
var sizeScale
var linkThicknessScale
var linkedByIds
var simulationRunning
var legend = new Legend()
var arrowDef
var zoomer
var autoZoomToFit

var defaultConfig = {
  legendWidth: 200,
  tooltipFormat: '%0',
  labelFormat: '%0',
  showLabels: 'all',
  linkDistance: 30,
  linkShowArrows: 'false',
  linkColour: '#08f',
  linkOpacity: 0.6,
  linkType: 'arc',
  linkMinWidth: 1,
  linkMaxWidth: 5,
  linkLabelFormat: '%2',
  linkTooltipFormat: '%2',
  showLinkTooltips: false,
  linkLabelPosition: 'end',
  showLinkLabels: 'none',
  useNodeColorColumn: false,
  useNodeSizeColumn: false,
  useNodeShapeColumn: false,
  nodeColorColumn: 0,
  nodeSizeColumn: 0,
  nodeShapeColumn: 0,
  nodeSizeOnLinkCount: false,
  nodeMinSize: 8,
  nodeMaxSize: 32,
  nodeRepelForce: 100,
  iterations: 100
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  mark: {
    selector: '#js_chart svg',
    type: JSVizHelper.markType.svg
  },
  configuratorTitle: 'Network Chart options',
  configuratorInstructions: [
    '<p>The network chart requires two sets of data:</p>',
    '<ul><li>The "nodes" table is specified first and contains information for the points in the chart.</li>',
    '<li>The "links" table is then specified with a list of links between nodes. Nodes are identified by the first column in the data and links specify two node ids along with the line thickness.</li></ul>',
    '<p>Nodes can optionally include other columns that can be used for tooltips, colours and shapes - use the settings below to link to the appropriate column.<br/>The min/max sizes for nodes and links are used to scale the incoming values - e.g. the node with the highest size value will be drawn using the max node size etc.</p>'
  ],
  configOptions: [
    {
      tab: 'Nodes',
      caption: 'Use data to define node colours',
      name: 'useNodeColorColumn',
      type: 'checkbox'
    },
    {
      tab: 'Nodes',
      caption: 'Node colour column',
      type: 'column-number',
      name: 'nodeColorColumn',
      enabledIfChecked: 'useNodeColorColumn'
    },
    {
      tab: 'Nodes',
      caption: 'Use data to define node sizes',
      type: 'checkbox',
      name: 'useNodeSizeColumn'
    },
    {
      tab: 'Nodes',
      caption: 'Node size column',
      type: 'column-number',
      name: 'nodeSizeColumn',
      enabledIfChecked: 'useNodeSizeColumn'
    },
    {
      tab: 'Nodes',
      caption: 'Use data to define node shapes',
      type: 'checkbox',
      name: 'useNodeShapeColumn'
    },
    {
      tab: 'Nodes',
      caption: 'Node shape column',
      type: 'column-number',
      name: 'nodeShapeColumn',
      enabledIfChecked: 'useNodeShapeColumn'
    },
    {
      tab: 'Nodes',
      caption: 'Use the number of links to size the node (ignored if you have a node size column defined)',
      type: 'checkbox',
      name: 'nodeSizeOnLinkCount',
      valueIfChecked: true,
      valueIfUnchecked: false,
      disabledIfChecked: 'useNodeSizeColumn'
    },
    {
      tab: 'Nodes',
      caption: 'Node minimum size',
      type: 'number',
      name: 'nodeMinSize',
      inputAttributes: {
        min: 1,
        max: 1000,
        step: 1
      }
    },
    {
      tab: 'Nodes',
      caption: 'Node maximum size',
      type: 'number',
      name: 'nodeMaxSize',
      inputAttributes: {
        min: 1,
        max: 1000,
        step: 1
      }
    },
    {
      tab: 'Links',
      caption: 'Show arrows on links',
      type: 'checkbox',
      name: 'linkShowArrows',
      valueIfChecked: true,
      valueIfUnchecked: false
    },
    {
      tab: 'Links',
      caption: 'Link line type',
      type: 'select',
      name: 'linkType',
      options: [
        { value: 'arc', text: 'Arc' },
        { value: 'line', text: 'Straight line' }
      ]
    },
    {
      tab: 'Links',
      caption: 'Minimum link line thickness',
      type: 'number',
      name: 'linkMinWidth',
      inputAttributes: {
        min: 1,
        max: 100,
        step: 1
      }
    },
    {
      tab: 'Links',
      caption: 'Maximum link line thickness',
      type: 'number',
      name: 'linkMaxWidth',
      inputAttributes: {
        min: 1,
        max: 100,
        step: 1
      }
    },
    {
      tab: 'Links',
      caption: 'Link line colour',
      type: 'color',
      name: 'linkColour'
    },
    {
      tab: 'Links',
      caption: 'Link line opacity (0=clear, 1=solid)',
      type: 'number',
      name: 'linkOpacity',
      inputAttributes: {
        min: 0,
        max: 1,
        step: 0.05
      }
    },
    {
      tab: 'Layout/Format',
      caption: 'Width of legend (in pixels)',
      type: 'number',
      name: 'legendWidth',
      inputAttributes: {
        min: 0,
        max: 10000,
        step: 10
      }
    },
    {
      tab: 'Layout/Format',
      caption: 'Node tooltip format (%0, %1, %2 etc. will be replaced by values from columns in the node table)',
      type: 'text',
      name: 'tooltipFormat'
    },
    {
      tab: 'Layout/Format',
      caption: 'Node label format (%0, %1, %2 etc. will be replaced by values from columns in the node table)',
      type: 'text',
      name: 'labelFormat'
    },
    {
      tab: 'Layout/Format',
      caption: 'Node labels to show',
      type: 'select',
      name: 'showLabels',
      options: [
        { value: 'all', text: 'All' },
        { value: 'marked', text: 'Only marked nodes' },
        { value: 'highlighted', text: 'Only highlighted nodes' },
        { value: 'markedHighlighted', text: 'Marked and highlighted nodes' }
      ]
    },
    {
      tab: 'Layout/Format',
      caption: 'Link tooltip format (%0, %1, %2 etc. will be replaced by values from columns in the link table)',
      type: 'text',
      name: 'linkTooltipFormat'
    },
    {
      tab: 'Layout/Format',
      caption: 'Show link tooltips?',
      type: 'checkbox',
      name: 'showLinkTooltips'
    },
    {
      tab: 'Layout/Format',
      caption: 'Link label format (%0, %1, %2 etc. will be replaced by values from columns in the links table)',
      type: 'text',
      name: 'linkLabelFormat'
    },
    {
      tab: 'Layout/Format',
      caption: 'Link label position',
      type: 'select',
      name: 'linkLabelPosition',
      options: [
        { value: 'end', text: 'End of link line' },
        { value: 'midpoint', text: 'Middle of link line' }
      ]
    },
    {
      tab: 'Layout/Format',
      caption: 'Link labels to show',
      type: 'select',
      name: 'showLinkLabels',
      options: [
        { value: 'all', text: 'All' },
        { value: 'none', text: 'None' }
      ]
    },
    {
      tab: 'Network',
      caption: 'Force with which the nodes repel one another (higher numbers = larger spread)',
      type: 'integer',
      name: 'nodeRepelForce',
      inputAttributes: {
        min: 1,
        max: 10000,
        step: 10
      }
    },
    {
      tab: 'Network',
      caption: 'Link \'spring\' length',
      type: 'integer',
      name: 'linkDistance',
      inputAttributes: {
        min: 10,
        max: 10000,
        step: 10
      }
    },
    {
      tab: 'Network',
      caption: 'Number of iterations to calculate (larger numbers mean potentially better layouts, but take longer)',
      type: 'number',
      name: 'iterations',
      inputAttributes: {
        min: 10,
        max: 1000,
        step: 10
      }
    }
  ]
})

// Class to handle drawing legend
function Legend () {
  // Used to store the last set of settings. We might have attributes change over time, so can't just use the values we first set in data and config
  var legendVisible
  var legendWidth
  var legendSVG
  var parentSVG
  var shapeG
  var shapeText
  var colourG
  var colourText
  var sizeG
  var sizeText
  var linkThicknessG
  var linkThicknessText
  var cropBeneathRect

  this.setup = function (data, config, svg) {
    legendVisible = data.legend
    legendWidth = config.legendWidth
    parentSVG = svg

    legendSVG = parentSVG.append('svg')
      .attr('width', legendWidth + 'px')
      .attr('height', '100%')
      .attr('x', parentSVG.node().getBBox().width - legendWidth + 1)
      .style('visibility', legendVisible ? 'visible' : 'hidden')

    // First thing is to hide anything behind the legend and be sure we eat mouse events
    cropBeneathRect = legendSVG.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('pointer-events', 'all')
      .on('mousedown', function () {
        // Stop JSViz from marking when we click the button
        currentEvent.stopPropagation()
      })

    // Create groups to hold the shape and colour sections (slightly offset vertically to leave room for the buttons)
    var legendG = legendSVG.append('g').attr('transform', 'translate(5,20)')
    shapeG = legendG.append('g')
    colourG = legendG.append('g')
    sizeG = legendG.append('g')
    linkThicknessG = legendG.append('g')

    shapeG.append('text').text('Shape by:')
    shapeText = shapeG.append('text')
    colourG.append('text').text('Color by:')
    colourText = colourG.append('text')
    sizeG.append('text').text('Size by:')
    sizeText = sizeG.append('text')
    linkThicknessG.append('text').text('Link thickness:')
    linkThicknessText = linkThicknessG.append('text')
  }

  this.width = function () {
    return legendVisible ? legendWidth : 0
  }

  this.windowResize = function () {
    legendSVG.attr('x', parent.innerWidth() - legendWidth + 1)
  }

  this.hide = function () {
    // Hide regardless of configuration
    legendSVG.style('visibility', 'hidden')
  }

  this.show = function () {
    // Show (if we should)
    legendSVG.style('visibility', legendVisible ? 'visible' : 'hidden')
  }

  this.render = function (data, config) {
    // Pick up any configuration changes
    legendVisible = data.legend
    legendWidth = config.legendWidth

    // First react to any changes in visibility or size
    legendSVG.style('visibility', legendVisible ? 'visible' : 'hidden')
      .attr('width', legendWidth + 'px')

    cropBeneathRect.style('fill', function () {
      var background = $('body').css('background-color')
      return (background === 'rgba(0, 0, 0, 0)' || background === 'transparent') ? 'white' : background
    })

    var fontSize = parseInt(parentSVG.style('font-size'))
    var legendSpacing = fontSize * 1.5
    var yOffset = legendSpacing

    // function for adding items to the legend
    function addToLegend (group, columnNameText, columnName, data, nodeColumn, allowMarking, shapeFunction, colorFunction, sizeFunction) {
      columnNameText.text(columnName)
        .attr('transform', 'translate(0,' + legendSpacing + ')')

      var uniqueItems = _.sortBy(_.map(_.uniq(data.data, function (d) { return d.items[nodeColumn].toString() }), function (d) { return d.items[nodeColumn].toString() }), function (d) { return d })

      var shapeItems = group.selectAll('g')
        .data(uniqueItems, function (d) { return d || d3.select(this).attr('data-id') })

      shapeItems.exit().remove()

      // Create a group containing a path and a text for the label
      var newItems = shapeItems.enter()
        .append('g')
        .attr('data-id', function (d) { return d })
        .on('mousedown', function () {
          // Stop JSViz from marking when we click the button
          currentEvent.stopPropagation()
        })

      if (allowMarking) {
        newItems.attr('cursor', 'pointer')
          .on('click', function (selected) {
            currentEvent.stopPropagation()
            var thisValue = d3.select(this).attr('data-id')
            var indices = _.map(_.filter(data.data, function (d) { return d.items[nodeColumn] === thisValue }), function (d) { return d.hints.index })
            var markData = { markMode: currentEvent.ctrlKey ? 'Toggle' : 'Replace', indexSet: indices }
            window.markIndices(markData)
          })
      }

      // Create the path and text elements
      newItems.append('path')
      newItems.append('text')

      // Now update all (both new and old)
      shapeItems = newItems.merge(shapeItems)
        .attr('transform', function (d, i) { return 'translate(0,' + (i + 2.5) * legendSpacing + ')' })

      shapeItems.selectAll('path')
        .attr('d', d3.symbol().type(shapeFunction)
          .size(function (d) { return Math.pow(sizeFunction(d), 2) }))
        .attr('transform', 'translate(' + fontSize / 2 + ',-' + fontSize / 2 + ')')
        .attr('fill', colorFunction)

      shapeItems.selectAll('text')
        .text(function (d) { return d })
        .attr('transform', 'translate(' + fontSize * 2 + ',0)')
        .attr('opacity', function (d) {
          if (!allowMarking || (data.baseTableHints.marked === 0)) {
            return 1
          } else {
            // Figure out if anything related to this entry is marked
            if (_.reduce(_.filter(data.data, function (d2) { return d2.items[nodeColumn] === d }), function (result, item) { return result || item.hints.marked }, false)) {
              return 1
            } else {
              return 0.25
            }
          }
        })

      return (uniqueItems.length) * legendSpacing + legendSpacing * 3.5
    }

    // Show shapes
    shapeG
      .style('visibility', config.useNodeShapeColumn ? null : 'hidden')
      .attr('transform', 'translate(0,' + legendSpacing + ')')

    if (config.useNodeShapeColumn) {
      yOffset += addToLegend(shapeG, shapeText, data.columns[config.nodeShapeColumn], data, config.nodeShapeColumn, true, function (d) { return shape(d) }, function (d) { return '#000' }, function (d) { return fontSize })
    }

    // Show Colours
    colourG
      .style('visibility', config.useNodeColorColumn ? null : 'hidden')
      .attr('transform', 'translate(0,' + yOffset + ')')

    if (config.useNodeColorColumn) {
      yOffset += addToLegend(colourG, colourText, data.columns[config.nodeColorColumn], data, config.nodeColorColumn, true, function (d) { return d3.symbolCircle }, function (d) { return color(d) }, function (d) { return fontSize })
    }

    // Show size
    sizeG
      .style('visibility', (config.useNodeSizeColumn || config.nodeSizeOnLinkCount) ? null : 'hidden')
      .attr('transform', 'translate(0,' + yOffset + ')')

    if (config.useNodeSizeColumn || config.nodeSizeOnLinkCount) {
      var dummyData = {
        data: [
          { items: ['Min : ' + sizeScale.domain()[0]] },
          { items: ['Max : ' + sizeScale.domain()[1]] }
        ]
      }
      yOffset += addToLegend(sizeG, sizeText, config.useNodeSizeColumn ? data.columns[config.nodeSizeColumn] : 'Number of links', dummyData, 0, false, function (d) { return d3.symbolCircle }, function (d) { return '#000' }, function (d) { return (d.substr(0, 3) === 'Min') ? fontSize / 4 : fontSize })
    }

    // Show link thickness
    linkThicknessG
      .style('visibility', (data.additionalTables[0].columns.length > 2) ? null : 'hidden')
      .attr('transform', 'translate(0,' + yOffset + ')')

    if (data.additionalTables[0].columns.length > 2) {
      dummyData = {
        data: [
          { items: ['Min : ' + linkThicknessScale.domain()[0]] },
          { items: ['Max : ' + linkThicknessScale.domain()[1]] }
        ]
      }
      yOffset += addToLegend(linkThicknessG, linkThicknessText, data.additionalTables[0].columns[2], dummyData, 0, false, function (d) { return d3.symbolSquare }, function (d) { return config.linkColour }, function (d) { return (d.substr(0, 3) === 'Min') ? config.linkMinWidth : config.linkMaxWidth })
    }
  }
}

// Called the first time (and only the first time) we render
function firstTimeSetup (data, config) {
  // Warn if the user is using IE - it doesn't work very well :(
  var ua = window.navigator.userAgent
  if (/MSIE|Trident/.test(ua)) {
    alert('Warning - This visualisation does not function correctly using Internet Explorer, please use Chrome instead.')
  }
  var selector = '#js_chart'

  parent = $(selector)

  // make sure we don't get any scrollbars
  parent.css('overflow', 'hidden')

  // Construct the network chart's SVG element
  svg = d3.select(selector).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')

  // Group used as parent to the chart - allows to us easily clear the content
  svgG = svg.append('g')
  svgG.append('g').attr('class', 'links')
  svgG.append('g').attr('class', 'nodes')

  // Set up zoom. Create a hidden rect to capture all mouse events (otherwise we only get events on visible elements).
  // Note that this is added after the group used for rendering - otherwise mouse events over drawing elements don't make it to the zoomer
  var zoom = d3.zoom()
    .on('zoom', function () {
      svgG.attr('transform', currentEvent.transform)
    })
  zoomer = svg.append('rect')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .call(zoom)
  zoomer.zoomToFit = function () {
    var bounds = svgG.node().getBBox()
    var fullWidth = parent.innerWidth() - legend.width()
    var fullHeight = parent.innerHeight()
    var width = bounds.width
    var height = bounds.height
    var midX = bounds.x + width / 2
    var midY = bounds.y + height / 2

    if (width === 0 || height === 0) return // nothing to fit

    var scale = 0.95 / Math.max(width / fullWidth, height / fullHeight)

    zoom.extent([[0, 0], [fullWidth, fullHeight]])

    zoomer
      .call(zoom.translateTo, midX, midY)
      .call(zoom.scaleTo, scale)
  }

  // Now add a legend group, which appears over everything else (so hides anything behind it)
  legend.setup(data, config, svg)

  // Setup filters for future reference
  var svgDefs = svg.append('defs')
  svgDefs.append('filter')
    .attr('id', 'inverted')
    .append('feColorMatrix').attr('values', '-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0')

  // Markers used for arrows
  arrowDef = svgDefs.append('marker')
    .attr('id', 'arrow')
    .attr('markerWidth', 10)
    .attr('markerHeight', 10)
    .attr('refX', '9')
    .attr('refY', '3')
    .attr('orient', 'auto')
    //    .attr('markerUnits', 'userSpaceOnUse')
    .append('path')
    .attr('d', 'M0,0 L0,6 L9,3 z')

  // Set up the force simulation
  simulation = d3.forceSimulation()
    .stop()
    .force('link', d3.forceLink().id(function (d) { return d.id }))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(parent.innerWidth() / 2, parent.innerHeight() / 2))
    .force('forceX', d3.forceX(0).strength(0.01)) // This force holds things near to the center, otherwise unlinked nodes can get pushed a long way away
    .force('forceY', d3.forceY(0).strength(0.01)) // The other part of the hold-to-center force

  // colour scale to be used
  color = d3.scaleOrdinal(d3.schemeCategory10)

  // Shape scale to be used
  shape = d3.scaleOrdinal(d3.symbols)

  // Size scale to be used
  sizeScale = d3.scaleLinear()

  // Link thickness scaling
  linkThicknessScale = d3.scaleLinear()

  // Setup the buttons
  var buttonPanel = $('<div>')
    .appendTo(parent)
    .css('position', 'absolute')
    .css('right', '0')
    .css('top', '0')
    .css('z-index', 999)
    .mousedown(function (event) {
      // Stop JSViz from marking when we click the button
      event.stopPropagation()
    })

  // A dialog for instructions
  var instructionsDialog = $('<div>')
    .appendTo('#js_chart')
    .dialog({
      autoOpen: false,
      modal: true,
      closeOnEscape: true,
      width: Math.min(500, $('#js_chart').width() - 20),
      title: 'Instructions for the Network Chart',
      buttons: {
        OK: function () {
          $(this).dialog('close')
        }
      },
      open: function (event, ui) {
        $('.ui-dialog-titlebar-close', ui.dialog | ui).hide()
      }
    })

  var instructions =
   'The network visualisation has two modes, which can be selected using the Mode button. In zoom/pan mode:' +
    '<ul><li>The mouse can be used to pan around the visualisation by clicking and dragging.</li>' +
   '<li>The mouse wheel can be used to zoom in/out.</li>' +
   '<li>Gesture controls on touch devices can be used for zoom and pan operations.</li></ul>' +
   'In mark mode:' +
   '<ul><li>Nodes can be dragged using the mouse or touch gestures.</li>' +
   '<li>Hovering over a node will show tooltips and highlight neighbouring nodes.</li>' +
   '<li>Nodes can be marked by clicking (which will select all neighbours) or drag selecting an area.</li></ul>' +
   'Additionally the following capabilities can be used in both modes:' +
   '<ul><li>Fit the network to the visible page by clicking the Fit button.</li>' +
   '<li>Auto fit while the network is generating using the Auto-fit toggle button.</li>' +
   '<li>Zoom in and out using the buttons.</li>' +
   '<li>Pause/resume the animation using the button.</li></ul>'

  $('<p>')
    .html(instructions)
    .appendTo(instructionsDialog)

  // A button for showing some instructions
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Help'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      instructionsDialog.dialog('open')
    })

  // This button flips between zooming using the mouse and marking (by enabling/disabling mouse events on the zoomer element)
  var zoomMode = 'zoom'
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Mode: zoom/pan'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      if (zoomMode === 'zoom') {
        zoomMode = 'mark'
        $(this).button('option', 'label', 'Mode: mark')
        zoomer.style('pointer-events', 'none')
      } else {
        zoomMode = 'zoom'
        $(this).button('option', 'label', 'Mode: zoom/pan')
        zoomer.style('pointer-events', 'all')
      }
    })

  // Auto zoom
  autoZoomToFit = true
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Auto-fit: On'
    })
    .click(function (event) {
      event.stopPropagation()
      autoZoomToFit = !autoZoomToFit
      $(this).button('option', 'label', 'Auto-fit: ' + (autoZoomToFit ? 'On' : 'Off'))
      if (autoZoomToFit) zoomer.zoomToFit()
    })

  // Zoom to fit
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Fit'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      zoomer.zoomToFit()
    })

  // Zoom in
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Zoom in'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      zoomer
        .transition()
        .duration(250) // milliseconds
        .call(zoom.scaleBy, 2)
    })

  // Zoom out
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Zoom out'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      zoomer
        .transition()
        .duration(250) // milliseconds
        .call(zoom.scaleBy, 0.5)
    })

  simulationRunning = true
  $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: simulationRunning ? 'Pause' : 'Resume'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      if (simulationRunning) {
        simulation.stop()
      } else {
        simulation.restart()
      }
      simulationRunning = !simulationRunning
      $(this).button('option', 'label', simulationRunning ? 'Pause' : 'Resume')
    })
}

// Main render method
function render (data, config) {
  // Do we need to restart from the beginning (e.g. node list changed, forces changed)
  var restartSimulation = false

  // Tell Spotfire we're busy - we'll tell it we're finished when the simulation settles. This helps with exporting and printing
  JSVizHelper.pushBusy('JSVizNetwork')

  // Stop the simulation for now - we'll resume when we're done
  if (simulationRunning) simulation.stop()

  // Check for a valid data configuration
  if ((data.additionalTables.length !== 1) || (data.columns.length < 1) || (data.additionalTables[0].columns.length < 2)) {
    JSVizHelper.showMessageInstead('Invalid data configuration. You need to define two tables, firstly a list of \'Nodes\' with at least one column containing an identifier and secondly a list of \'Links\' with at least 2 columns giving node identifiers that are linked together. Additional Node columns can be used to define size, shape, colour, labels and tooltips. A third Link column can be used to specify the width of each link.')
    return
  }

  // Update the default fill color (particularly for text) in case theme changes
  svg.attr('fill', $('body').css('color'))

  // Create a data array for nodes, then attempt to merge with any previous one so that we keep any existing calculations when things like Marking happen
  var oldNodeData = simulation.nodes()
  if (oldNodeData.length !== data.data.length) restartSimulation = true
  var nodeData = _.reduce(data.data, function (result, d) {
    // Find any existing values, then overwrite with new
    var newNode = _.findWhere(oldNodeData, { id: d.items[0] })
    if (newNode === undefined) {
      newNode = {}
      restartSimulation = true
    }
    _.extend(newNode, { id: d.items[0], items: d.items, hints: d.hints, tooltip: config.tooltipFormat, label: config.labelFormat })
    _.each(d.items, function (value, index) {
      newNode.tooltip = newNode.tooltip.replace('%' + index, value)
      newNode.label = newNode.label.replace('%' + index, value)
    })
    newNode.linkCount = 0 // Count each time since links may have changed
    result.push(newNode)
    return result
  }, [])

  // Check for an empty visual
  if (nodeData.length === 0) {
    JSVizHelper.showMessageInstead('No data to show')
    return
  }

  // Create an array in the right format for links
  var linkData = _.reduce(data.additionalTables[0].data, function (result, d) {
    var newLink = { source: _.findWhere(nodeData, { id: d.items[0] }), target: _.findWhere(nodeData, { id: d.items[1] }), value: (d.items[2] || 1) }
    // Only add the link if both nodes are in the data (to support filtering on Nodes within Spotfire)
    if ((newLink.source !== undefined) && (newLink.target !== undefined)) {
      _.extend(newLink, { tooltip: config.linkTooltipFormat, label: config.linkLabelFormat })
      _.each(d.items, function (value, index) {
        newLink.tooltip = newLink.tooltip.replace('%' + index, value)
        newLink.label = newLink.label.replace('%' + index, value)
      })
      newLink.source.linkCount++
      newLink.target.linkCount++
      result.push(newLink)
    }
    return result
  }, [])

  // This array is used to determine if nodes are linked to each other during highlighting operations. indexes are of the form '<id1>,<id2>' using linked ids - so simple to look up if a pair of nodes are linked
  linkedByIds = _.reduce(linkData, function (result, d) { result[d.source.id + ',' + d.target.id] = true; return result }, [])

  // helper function for highlighting neighbours
  var isNeighbour = function (a, b) {
    return a === b || linkedByIds[a.id + ',' + b.id] || linkedByIds[b.id + ',' + a.id]
  }

  // Figure out the size scale
  var domain = _.reduce(nodeData, function (result, d) {
    d.size = config.useNodeSizeColumn ? d.items[config.nodeSizeColumn] : (config.nodeSizeOnLinkCount ? d.linkCount : 1)
    result[0] = Math.min(result[0], d.size)
    result[1] = Math.max(result[1], d.size)
    return result
  }, [Infinity, -Infinity])

  if (!_.isEqual(sizeScale.domain(), domain)) {
    sizeScale.domain(domain)
    restartSimulation = true
  }
  var range = [config.nodeMinSize, config.nodeMaxSize]
  if (!_.isEqual(sizeScale.range(), range)) {
    sizeScale.range(range)
    restartSimulation = true
  }

  // Now the link thickness scale
  domain = _.reduce(linkData, function (result, d) {
    result = [Math.min(result[0], d.value), Math.max(result[1], d.value)]
    return result
  }, [Infinity, -Infinity])

  if (!_.isEqual(linkThicknessScale.domain(), domain)) {
    linkThicknessScale.domain(domain)
    restartSimulation = true
  }

  range = [config.linkMinWidth, config.linkMaxWidth]
  if (!_.isEqual(linkThicknessScale.range(), range)) {
    linkThicknessScale.range(range)
    restartSimulation = true
  }

  // Create the link elements in the SVG
  var link = svgG.selectAll('.links')
    .selectAll('g')
    .data(linkData, function (d) { return d ? d.source.id + ',' + d.target.id : this.attr('data-id') })

  link.exit().remove()

  // Capture the new merged selection for future use
  var newLinks = link.enter()
    .append('g')
    .attr('data-id', function (d) { return d.source.id + ',' + d.target.id })

  newLinks.append('path').append('title')
  newLinks.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')

  link = newLinks.merge(link)

  link.selectAll('path')
    .attr('stroke-width', function (d) { return linkThicknessScale(d.value) })
    .attr('stroke', config.linkColour)
    .attr('fill', 'transparent')
    .attr('marker-end', function (d) { return (config.linkShowArrows.toString() === 'true') ? 'url(#arrow)' : '' })
    .attr('opacity', function (d) {
      return (data.baseTableHints.marked === 0) ? config.linkOpacity : ((d.source.hints.marked && d.target.hints.marked) ? 1 : 0.25)
    })

  // Update the link labels
  link.selectAll('text')
    .attr('visibility', function (d) {
      if (config.showLinkLabels === 'all') {
        return 'visible'
      } else {
        return 'hidden'
      }
    })
    .text(function (d) {
      return d.label
    })

  // Update the tooltips
  link.selectAll('path').selectAll('title')
    .text(function (d) {
      if (config.showLinkTooltips) {
        return d.tooltip
      } else {
        return ''
      }
    })

  // Create the node elements in the SVG
  var node = svgG.selectAll('.nodes')
    .selectAll('g')
    .data(nodeData, function (d) { return d ? d.id : this.attr('data-id') })

  node.exit().remove()

  // Create a group containing a path (with tooltip) and a text for the label, along with a data-id for the join
  var newNodes = node.enter()
    .append('g')
    .attr('cursor', 'pointer')
    .attr('data-id', function (d) { return d.id })

  newNodes.append('path').append('title')
  newNodes.append('text')

  // Capture the new merged selection for future use
  node = newNodes.merge(node)

  // Now update all (both new and old)
  node.selectAll('path')
    .attr('d', d3.symbol()
      .size(function (d) {
        return Math.pow(sizeScale(d.size), 2)
      })
      .type(function (d) {
        return config.useNodeShapeColumn ? shape(d.items[config.nodeShapeColumn]) : d3.symbolCircle
      }))
    .attr('fill', function (d) {
      return config.useNodeColorColumn ? color(d.items[config.nodeColorColumn]) : color(0)
    })
    .attr('opacity', function (d) {
      return (data.baseTableHints.marked === 0 || d.hints.marked) ? 1 : 0.25
    })
    .attr('data-id', function (d) { return d.hints.index })
    .on('mouseover', function (selected) {
      node.selectAll('path').attr('filter', function (d) { if (isNeighbour(selected, d)) return 'url(#inverted)'; else return '' })
      link.attr('filter', function (d) { if ((selected.id === d.source.id) || (selected.id === d.target.id)) return 'url(#inverted)'; else return '' })
      if (config.showLabels === 'highlighted' || config.showLabels === 'markedHighlighted') {
        node.selectAll('text').attr('visibility', function (d) { if (isNeighbour(selected, d)) return 'visible'; else return 'hidden' })
      }
    })
    .on('mouseout', function () {
      node.selectAll('path').attr('filter', '')
      link.attr('filter', '')
      if (config.showLabels === 'highlighted' || config.showLabels === 'markedHighlighted') {
        node.selectAll('text').attr('visibility', function () { return d3.select(this).attr('x-saved-visibility') })
      }
    })
    .on('click', function (selected) {
      currentEvent.stopPropagation()
      var indexSet = []
      node.each(function (d) {
        if (isNeighbour(selected, d)) indexSet.push(d.hints.index)
      })
      var markData = { markMode: currentEvent.shiftKey ? 'Add' : (currentEvent.ctrlKey ? 'Toggle' : 'Replace'), indexSet: indexSet }
      window.markIndices(markData)
    })
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded))

  // Update the tooltips
  node.selectAll('path').selectAll('title')
    .text(function (d) {
      return d.tooltip
    })

  // Update the labels
  node.selectAll('text')
    .attr('dx', function (d) { return (sizeScale(d.size) / 2) + 4 })
    .attr('dy', '.35em')
    .attr('visibility', function (d) {
      if (config.showLabels === 'all') {
        return 'visible'
      } else if (config.showLabels === 'marked' || config.showLabels === 'markedHighlighted') {
        return (d.hints.marked || false) ? 'visible' : 'hidden'
      } else {
        return 'hidden'
      }
    })
    .attr('x-saved-visibility', function () { return d3.select(this).attr('visibility') })
    .text(function (d) {
      return d.label
    })

  // Now render the legend
  legend.render(data, config)

  // Set the arrow definition to nicely render
  arrowDef.attr('fill', config.linkColour)

  // Set up the force simulation and start it running (we need to run it manually if we've changed data (e.g. marking changes))
  if (simulation.force('link').distance()() !== +config.linkDistance) {
    restartSimulation = true
    simulation.force('link').distance(+config.linkDistance)
    simulation.force('charge').distanceMax((+config.linkDistance) * 10)
  }

  simulation.force('link')
    .links(linkData)

  if (simulation.force('charge').strength()() !== -config.nodeRepelForce) {
    restartSimulation = true
    simulation.force('charge').strength(-config.nodeRepelForce)
  }

  var newDecay = 1 - Math.pow(0.001, 1 / config.iterations)
  if (simulation.alphaDecay() !== newDecay) {
    simulation.alphaDecay(newDecay)
    restartSimulation = true
  }

  // If we need to restart (e.g. different nodes, changes to configuration), clear out x, y etc. and start again
  if (restartSimulation) {
    _.each(nodeData, function (d) {
      d.x = d.y = d.vx = d.vy = NaN
    })
    simulation.alpha(1)
    JSVizHelper.pushBusy('JSVizNetwork')
  }

  simulation
    .nodes(nodeData)
    .on('tick', function () {
      // Called each time the force simulation updates. Use this to change the attributes on our drawing elements so that the chart draws appropriately
      link
        .each(function (d, i, n) {
          // We need to calculate where the edge of the nodes is and use that at the ends of the linkedByIds
          // Otherwise any arrows will be drawn underneath the nodes
          // We pick a point that is where a circle would end - looks OK (if not perfect) for a variety of shapes
          var x1 = d.source.x
          var y1 = d.source.y
          var r1 = sizeScale(d.source.size) / 2
          var x2 = d.target.x
          var y2 = d.target.y
          var r2 = sizeScale(d.target.size) / 2
          var dx = x2 - x1
          var dy = y2 - y1
          var dr = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
          var edgeXRatio = dx / dr
          var edgeYRatio = dy / dr

          // The new positions based on moving to the edge of a circle on each node
          x1 = x1 + r1 * edgeXRatio
          y1 = y1 + r1 * edgeYRatio
          x2 = x2 - r2 * edgeXRatio
          y2 = y2 - r2 * edgeYRatio

          // Label end is a few pixels back along the line from the ends
          var xLabelEnd = x2 - 5 * edgeXRatio
          var yLabelEnd = y2 - 5 * edgeYRatio

          d3.select(this).selectAll('path')
            .attr('d', function (d) {
              if (config.linkType === 'arc') {
                return 'M' + x1 + ',' + y1 + ' A' + dr + ',' + dr + ',0,0,1,' + x2 + ',' + y2
              } else {
                return 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2
              }
            })

          d3.select(this).selectAll('text')
            .attr('x', function (d) {
              if (config.linkLabelPosition === 'midpoint') {
                return (x1 + x2) / 2
              } else {
                return xLabelEnd
              }
            })
            .attr('y', function (d) {
              if (config.linkLabelPosition === 'midpoint') {
                return (y1 + y2) / 2
              } else {
                return yLabelEnd
              }
            })
        })

      node
        .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')' })

      if (autoZoomToFit) zoomer.zoomToFit()
    })
    .on('end', function () {
      // We're done - tell Spotfire that we're not busy any more
      JSVizHelper.popBusy('JSVizNetwork')
    })

  // Now we can resume processing
  if (simulationRunning) simulation.restart()
}

// Allow the user to drag a node
function dragStarted (d) {
  if (!currentEvent.active && simulationRunning) simulation.alphaTarget(0.3).restart()
  d.fx = d.x
  d.fy = d.y
}

function dragged (d) {
  d.fx = currentEvent.x
  d.fy = currentEvent.y
}

function dragEnded (d) {
  if (!currentEvent.active && simulationRunning) simulation.alphaTarget(0)
  d.fx = null
  d.fy = null
}

// Handle window resizing - change the center force and make sure the simulation runs if it's stopped
window.onresize = function (event) {
  simulation.force('center').x(parent.innerWidth() / 2).y(parent.innerHeight() / 2)
  if (simulationRunning) simulation.alphaTarget(0).restart()
  legend.windowResize()
}
