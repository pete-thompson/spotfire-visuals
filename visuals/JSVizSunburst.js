/* eslint-disable compat/compat */
// Visualise using a Sunburst Chart
// Much code adapted from https://observablehq.com/@d3/zoomable-sunburst

import { event as currentEvent } from 'd3-selection'

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')

var d3 = _.extend({}, require('d3-array'), require('d3-collection'), require('d3-format'), require('d3-hierarchy'), require('d3-interpolate'), require('d3-scale'), require('d3-scale-chromatic'), require('d3-selection'), require('d3-shape'), require('d3-transition'))

var $ = require('jquery')

var parent
var svg
var outerG
var arcG
var defs
var labelG
var margin = { left: 10, right: 10, top: 10, bottom: 10 }
var size = { width: 0, height: 0 }
var levelRadius
var center
// eslint-disable-next-line no-undef
var arcUniqueIds = new Map()
var colourDomain = []
var modeButton
var zoomMode = 'zoom'

var defaultConfig = {
  valueFormat: ',d',
  allowZoom: true,
  levelsVisible: 3
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  configButton: JSVizHelper.configButton.textLeft,
  firstTimeSetup: firstTimeSetup,
  render: render,
  renderOnResize: true,
  mark: {
    type: JSVizHelper.markType.callback,
    ignoreClicks: true,
    callback: markLasso
  },
  configuratorTitle: 'Sunburst Chart options',
  configuratorInstructions: [
    '<p>The Sunburst chart requires a single table containing your data.',
    'The last column in the table should contain the value to use for sizing, with the other columns providing the hierarchy of the sunburst.</p>',
    '<p>Format strings use D3 format - see <a href="https://github.com/d3/d3-format">d3-format documentation</a></p>'
  ],
  configOptions: [
    {
      caption: 'Value format string',
      type: 'text',
      name: 'valueFormat'
    },
    {
      caption: 'Allow user to zoom?',
      type: 'checkbox',
      name: 'allowZoom'
    },
    {
      caption: 'Levels visible',
      type: 'number',
      name: 'levelsVisible',
      enabledIfChecked: 'allowZoom',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    }
  ]
})

// Called the first time (and only the first time) we render
function firstTimeSetup (data, config) {
  parent = $('#js_chart')

  // make sure we don't get any scrollbars
  parent.css('overflow', 'hidden')

  // Construct the network chart's SVG element
  svg = d3.select('#js_chart').append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .on('click', function () {
      if (zoomMode === 'mark') {
        var markData = { markMode: JSVizHelper.getMarkMode(currentEvent), indexSet: [] }
        window.markIndices(markData)
      }
    })

  outerG = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .style('isolation', 'isolate')

  arcG = outerG.append('g')
  labelG = outerG.append('g')
    .attr('pointer-events', 'none')
    .attr('text-anchor', 'middle')
    .style('user-select', 'none')

  defs = svg.append('defs')

  // Setup the buttons
  var buttonPanel = $('<div>')
    .appendTo(parent)
    .css('position', 'absolute')
    .css('right', '0')
    .css('top', '0')
    .css('z-index', 999)

  // A dialog for instructions
  var instructionsDialog = $('<div>')
    .appendTo('#js_chart')
    .dialog({
      autoOpen: false,
      modal: true,
      closeOnEscape: true,
      width: Math.min(500, $('#js_chart').width() - 20),
      title: 'Instructions for the Sunburst Chart',
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
    'A Sunburst chart is a multilevel pie chart used to represent the proportion of different values found at each level in a hierarchy.<br/>' +
    '<span id="zoomInstructions">The Sunburst chart has two modes, which can be selected using the Mode button. In zoom mode ' +
    'clicking on a segment will drill in to show details of that segment and its children, ' +
    'whereas in mark mode clicking on a segment will mark that segment and its children.<br/>' +
    'Pie segments are shown in a darker colour when child segments are available, thus indicating where zooming is available. </span>'

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

  // This button flips between zooming and marking
  modeButton = $('<button>')
    .appendTo(buttonPanel)
    .button({
      label: 'Mode: zoom'
    })
    .show()
    .click(function (event) {
      event.stopPropagation()
      if (zoomMode === 'zoom') {
        zoomMode = 'mark'
        $(this).button('option', 'label', 'Mode: mark')
      } else {
        zoomMode = 'zoom'
        $(this).button('option', 'label', 'Mode: zoom')
      }
    })
}

function enableDisableZoom (enabled) {
  if (enabled) {
    modeButton.show()
    $('#zoomInstructions').css('display', '')
  } else {
    zoomMode = 'mark'
    modeButton.hide()
    $('#zoomInstructions').css('display', 'none')
  }
}

// Main render method
function render (data, config) {
  // Update the default fill color (particularly for text) in case theme changes
  svg.attr('fill', $('body').css('color'))

  // Enable or disable zoom
  enableDisableZoom(config.allowZoom)

  // Convert the data into d3 hierarchical form
  // We assume that the last column in the data is the numeric value to use for the size
  // and that all other columns are text representing the hierarchy
  // We will automatically roll up multiple rows with matching hierarchy values
  const columnCount = data.columns.length
  const grouping = Array.from(Array(columnCount - 1).keys()).map(x => d => { return d.items[x] })
  const group = d3.rollup(data.data, v => { return { indices: v.map(x => x.hints.index), marked: v.reduce((a, b) => a || b.hints.marked, false), value: v.reduce((a, b) => a + b.items[columnCount - 1], 0) } }, ...grouping)
  var root = d3.hierarchy(group)

  // Now simplify the hierarchy object - ensure each node has:
  // name - the text to show
  // hints - an array of row hints for marking
  // value - the total value of all rows within the node
  var anyMarked = false
  root.each(d => {
    d.current = d
    d.name = d.data[0]
    d.path = d.ancestors().map(d => d.name).reverse().join('/').substr(1)
    if (d.children) {
      const answer = d.leaves().reduce((a, b) => {
        a.indices = a.indices.concat(b.data[1].indices)
        a.value = a.value + b.data[1].value
        a.marked = a.marked || b.data[1].marked
        return a
      }, { indices: [], value: 0, marked: false })
      d.indices = answer.indices
      d.value = answer.value
      d.marked = answer.marked
    } else {
      d.indices = d.data[1].indices
      d.value = d.data[1].value
      d.marked = d.data[1].marked
    }
    anyMarked = anyMarked || d.marked
  })

  // Trim out any nodes with no name - supports sparse hierarchies in data presented as rows/columns
  root.name = ''
  function filterData (data, id) {
    var r = data.filter(function (o) {
      if (o.children) {
        o.children = filterData(o.children, id)
        if (o.children.length === 0) {
          delete o.children
        }
      }
      return o.name !== null
    })
    return r
  }
  root.children = filterData(root.children)

  // Now create the partition layout, using size useful for radial layout
  root.sort((a, b) => b.value - a.value)
  const partition = d3.partition().size([2 * Math.PI, root.height + 1])
  root = partition(root)

  // Figure out size
  size.width = parent.innerWidth() - margin.left - margin.right
  size.height = parent.innerHeight() - margin.top - margin.bottom
  levelRadius = Math.min(size.width, size.height) / ((config.allowZoom ? config.levelsVisible : root.height) + 1) / 2

  // Coordinates are (0,0) at the center of the SVG
  center = { x: size.width / 2 + margin.left, y: size.height / 2 + margin.top }
  outerG.attr('transform', `translate(${center.x},${center.y})`)

  // Colours - we track all data we ever see in case data is filtered and re-displayed
  const newColourDomain = root.children.map(x => x.name)
  // eslint-disable-next-line no-undef
  colourDomain = [...new Set(colourDomain.concat(newColourDomain))]
  const color = d3.scaleOrdinal(d3.schemeCategory10).domain(colourDomain)

  // Value formatting
  const format = d3.format(config.valueFormat)

  // generate arc Ids for DOM use (note this table holds across renders, so deals with the data changing for any reason)
  root.descendants().map((d) => {
    if (!arcUniqueIds.has(d.path)) {
      arcUniqueIds.set(d.path, arcUniqueIds.size)
    }
  })

  // The shape to draw
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(levelRadius * 1.5)
    .innerRadius(d => d.y0 * levelRadius)
    .outerRadius(d => Math.max(d.y0 * levelRadius, d.y1 * levelRadius - 1))

  // Draw the chart
  const mainTransition = d3.select('#js_chart').transition('main').duration(1000)
  const markingTransition = d3.select('#js_chart').transition('marking').duration(200)

  // First some defs to use to clip the text to arcs
  const clipPaths = defs.selectAll('clipPath')
    .data(root.descendants().slice(1), (d) => d.path)

  clipPaths.exit()
    .remove()

  const clipPathsEnterPaths = clipPaths.enter()
    .append('clipPath')
    .attr('id', d => 'arc-' + arcUniqueIds.get(d.path))
    .append('path')
    .attr('d', d => arc(d.current))

  // We only transition those that already exist
  clipPaths.select('path')
    .transition(mainTransition)
    .attr('d', d => arc(d.current))

  const clipPathPaths = clipPaths.select('path').merge(clipPathsEnterPaths)

  // Now the arcs themselves
  const arcs = arcG.selectAll('path')
    .data(root.descendants().slice(1), (d) => d.path)

  arcs.exit()
    .remove()

  const arcsEnter = arcs.enter()
    .append('path')
    .attr('fill', d => { while (d.depth > 1) { d = d.parent } return color(d.name) })
    .attr('fill-opacity', d => arcOpacity(d, d.current))
    .attr('d', d => arc(d.current))
    .on('click', clicked)

  const arcsEnterTitle = arcsEnter.append('title')

  const arcsMerge = arcs.merge(arcsEnter)

  // We only transition those that already exist
  arcs.transition(mainTransition)
    .attr('d', d => arc(d.current))

  arcs.transition(markingTransition)
    .attr('fill-opacity', d => arcOpacity(d, d.current))

  // Tooltips (no transition)
  arcs.select('title')
    .merge(arcsEnterTitle)
    .text(d => `${d.path}\n${format(d.value)}`)

  const label = labelG.selectAll('g')
    .data(root.descendants().slice(1), (d) => d.path)

  label.exit()
    .remove()

  // We use a G to set the clip path
  const labelEnter = label.enter()
    .append('g')
    .style('clip-path', d => `url(#${'arc-' + arcUniqueIds.get(d.path)})`)

  // Now we can use Text with a transform - otherwise the transform applies to the clip path and nothing appears
  const labelEnterText = labelEnter.append('text')
    .attr('dy', '0.35em')
    .text(d => d.name)
    .attr('fill-opacity', d => +labelVisible(d.current))
    .attr('transform', d => labelTransform(d.current))

  const labelTextMerge = label.select('text').merge(labelEnterText)

  // We only transition those that already exist
  label.select('text')
    .transition(mainTransition)
    .attr('fill-opacity', d => +labelVisible(d.current))
    .attr('transform', d => labelTransform(d.current))

  function clicked (p) {
    currentEvent.stopPropagation()
    // check for marking or zoom
    if (zoomMode === 'mark') {
      var markData = { markMode: JSVizHelper.getMarkMode(currentEvent), indexSet: p.indices }
      window.markIndices(markData)
    } else {
      // zooming only available for arcs with children
      if (p.children) {
        // Check if we clicked on the center
        if ((p.target) && (p.target.y0 === 0)) {
          p = p.parent
        }

        // Update 'target' on all data associated with arcs (note, not using the root variable since arcs from a previous render won't link to the root objects)
        arcsMerge.data().forEach(d => {
          d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth),
            name: d.name
          }
        })

        // Transition the data on all arcs, even the ones that aren’t visible,
        // so that if this transition is interrupted, entering arcs will start
        // the next transition from the desired position.
        const clickTransition = d3.select('#js_chart').transition('main').duration(1000)
        clipPathPaths.transition(clickTransition)
          .tween('data', d => {
            const i = d3.interpolate(d.current, d.target)
            return t => { d.current = i(t) }
          })
          .attrTween('d', d => () => arc(d.current))

        arcsMerge.transition(clickTransition)
          .tween('data', d => {
            const i = d3.interpolate(d.current, d.target)
            return t => { d.current = i(t) }
          })
          .filter(function (d) {
            return +this.getAttribute('fill-opacity') || arcVisible(d.target)
          })
          .attr('fill-opacity', d => arcOpacity(d, d.target))
          .attrTween('d', d => () => arc(d.current))

        // Transition for labels when we click
        labelTextMerge.filter(function (d) {
          return +this.getAttribute('fill-opacity') || labelVisible(d.target)
        }).transition(clickTransition)
          .attr('fill-opacity', d => +labelVisible(d.target))
          .attr('transform', d => labelTransform(d.target))
      }
    }
  }

  // Only visible if in first n levels or zoom off
  function arcVisible (d) {
    return (!config.allowZoom || (d.y1 <= (config.levelsVisible + 1))) && d.y0 >= 0 && d.x1 > d.x0
  }

  // Only visible if in first n levels or zoom off and it's a reasonably large arc
  function labelVisible (d) {
    return (!config.allowZoom || (d.y1 <= (config.levelsVisible + 1) && d.y0 >= 0)) && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
  }

  // Calculate appropriate rotation and translation to position the label
  function labelTransform (d) {
    if (d.y0 === 0) {
      return 'rotate(0) translate(0,0) rotate(0)'
    } else {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI
      const y = (d.y0 + d.y1) / 2 * levelRadius
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`
    }
  }

  function arcOpacity (d, currentOrTarget) {
    return arcVisible(currentOrTarget) ? (d.children ? (d.marked ? 0.8 : (anyMarked ? 0.4 : 0.6)) : (d.marked ? 0.6 : (anyMarked ? 0.2 : 0.4))) : 0
  }
}

// Called when an area has been selected for marking.
function markLasso (markMode, rectangle) {
  // Add properties with DOM style names to our rectangle
  rectangle.left = rectangle.x
  rectangle.top = rectangle.y

  // Helper function to convert screen (x,y) into polar coordinates that match the system used for the data (x0,y0) coordinates
  function polar (x, y) {
    x = x - center.x
    y = y - center.y
    var answer = {
      x: 0,
      y: Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)) / levelRadius
    }

    if (x === 0) {
      answer.x = (y >= 0) ? 0 : Math.PI
    } else {
      const angle = Math.atan(x / -y)
      // D3 polar coordinates start at with 0 at 12 O Clock and increase clockwise
      const segment = (x >= 0 && y < 0) ? 0 : (x >= 0 && y >= 0) ? Math.PI : (x < 0 && y >= 0) ? Math.PI : (Math.PI * 2)
      answer.x = angle + segment
    }
    return answer
  }
  // Helper function to convert from polar coordinates that match the system used for the data (x0,y0) coordinates to screen (x,y) catesian
  function cartesian (radians, radius) {
    return {
      x: radius * levelRadius * Math.sin(radians) + center.x,
      y: center.y - radius * levelRadius * Math.cos(radians)
    }
  }

  // Convert the rectangle into polar coordinates that we can compare with the (x0,y0) (x1,y1) coordinates on our objects
  const rectPolar = [polar(rectangle.left, rectangle.top), polar(rectangle.left, rectangle.top + rectangle.height), polar(rectangle.left + rectangle.width, rectangle.top + rectangle.height), polar(rectangle.left + rectangle.width, rectangle.top)]

  function pointInRect (point, rect) {
    return (point.x >= rect.left) && (point.x <= (rect.left + rect.width)) && (point.y >= rect.top) && (point.y <= (rect.top + rect.height))
  }

  // Search all object data to compare coordinates
  var markData = { markMode: markMode, indexSet: [] }
  arcG.selectAll('path').each(function (d) {
    var intersect = false
    // First check if any of the points of the rectangle fall within the arc (using polar coordinates)
    const arcRectPolar = { left: d.x0, width: (d.x1 - d.x0), top: d.y0, height: (d.y1 - d.y0) }
    for (var point = 0; point < 4; point++ && !intersect) {
      intersect = intersect || pointInRect(rectPolar[point], arcRectPolar)
    }
    // Now check if any point of the arc is contained within the rectangle
    intersect = intersect ||
      pointInRect(cartesian(d.x0, d.y0), rectangle) ||
      pointInRect(cartesian(d.x0, d.y1), rectangle) ||
      pointInRect(cartesian(d.x1, d.y0), rectangle) ||
      pointInRect(cartesian(d.x1, d.y1), rectangle)
    // TODO - detect intersection with an edge

    if (intersect) {
      markData.indexSet = markData.indexSet.concat(d.indices)
    }
  })

  window.markIndices(markData)
}
