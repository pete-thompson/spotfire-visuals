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
var lastConfig
// eslint-disable-next-line no-undef
var arcUniqueIds = new Map()
var colourDomain = []
var modeButton
var zoomMode = 'zoom'
var totalLevelsVisible
var anyMarked
var currentCenterPath
var clipPathsMerge
var arcsMerge
var labelMerge
// eslint-disable-next-line no-undef
var D3data = new Map()
var arc

var defaultConfig = {
  valueFormat: ',d',
  allowZoom: true,
  showValueOnLabel: false,
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
      caption: 'Show value on label?',
      type: 'checkbox',
      name: 'showValueOnLabel'
    },
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
      var markData = { markMode: JSVizHelper.getMarkMode(currentEvent), indexSet: [] }
      window.markIndices(markData)
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
    'whereas in mark mode clicking on a segment will mark that segment and its children. ' +
    'Once zoomed in, you can zoom out again by clicking on the central circle. ' +
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
        $('.zoomable').css('cursor', '')
      } else {
        zoomMode = 'zoom'
        $(this).button('option', 'label', 'Mode: zoom')
        $('.zoomable').css('cursor', 'pointer')
      }
    })
}

function enableDisableZoom (enabled) {
  if (enabled) {
    modeButton.show()
    $('#zoomInstructions').css('display', '')
    $('.zoomable').css('cursor', 'pointer')
  } else {
    zoomMode = 'mark'
    modeButton.hide()
    $('#zoomInstructions').css('display', 'none')
    $('.zoomable').css('cursor', '')
  }
}

// Main render method
function render (data, config) {
  lastConfig = config

  // Update the default fill color (particularly for text) in case theme changes
  svg.attr('fill', $('body').css('color'))

  // Convert the data into d3 hierarchical form
  // We assume that the last column in the data is the numeric value to use for the size
  // and that all other columns are text representing the hierarchy
  // We will automatically roll up multiple rows with matching hierarchy values
  const columnCount = data.columns.length
  const grouping = Array.from(Array(columnCount - 1).keys()).map(x => d => { return d.items[x] })
  const group = d3.rollup(data.data, v => { return { indices: v.map(x => x.hints.index), marked: v.reduce((a, b) => a || b.hints.marked, false), value: v.reduce((a, b) => a + b.items[columnCount - 1], 0) } }, ...grouping)
  var root = d3.hierarchy(group)

  // Check for an empty visual
  if (root.height === 0) {
    JSVizHelper.showMessageInstead('No data to show')
    return
  }

  // Now simplify the hierarchy object - ensure each node has:
  // name - the text to show
  // hints - an array of row hints for marking
  // value - the total value of all rows within the node
  anyMarked = false
  var currentCenter
  root.each(d => {
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
    if ((currentCenterPath === d.path) && (currentCenterPath !== '')) currentCenter = d
  })

  // Trim out any nodes with no name - supports sparse hierarchies in data presented as rows/columns
  root.name = ''
  function filterData (data) {
    var r = data.filter(function (o) {
      if (o.children) {
        o.children = filterData(o.children)
        if (o.children.length === 0) {
          delete o.children
        }
      }
      return o.data[0] !== null
    })
    return r
  }
  root.children = filterData(root.children)

  // Now create the partition layout, using size useful for radial layout
  root.sort((a, b) => b.value - a.value)
  const partition = d3.partition().size([2 * Math.PI, root.height + 1])
  root = partition(root)

  // Check if currently zoomed center is still in the data, set new center appropriately
  if (!currentCenter) {
    currentCenterPath = root.path
    currentCenter = root
  }

  // Figure out size
  size.width = parent.innerWidth() - margin.left - margin.right
  size.height = parent.innerHeight() - margin.top - margin.bottom
  totalLevelsVisible = config.allowZoom ? config.levelsVisible : root.height
  levelRadius = Math.min(size.width, size.height) / (totalLevelsVisible + 1) / 2

  // The shape to draw
  arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(levelRadius * 1.5)
    .innerRadius(d => d.y0 * levelRadius)
    .outerRadius(d => Math.max(d.y0 * levelRadius, d.y1 * levelRadius - 1))

  // D3 data joining relies on using the same JavaScript object across calls to the render method
  // We use this helper to keep a single set of objects that can be joined in D3 selections
  // across multiple renders
  D3data.forEach((value) => { value.present = false })
  root.descendants().slice(1).forEach(d => {
    if (D3data.has(d.path)) {
      const existing = D3data.get(d.path)
      d.current = existing.object.current
      existing.object = d
      existing.present = true
    } else {
      d.current = { x0: 0, x1: 0, y0: 0, y1: 0 }
      D3data.set(d.path, { path: d.path, object: d, present: true })
    }
  })
  const D3DataArray = []
  D3data.forEach((value) => { if (value.present) D3DataArray.push(value) })

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

  // Draw the chart
  // Now the arcs themselves
  const arcs = arcG.selectAll('path')
    .data(D3DataArray, (d) => d ? 'arc-' + arcUniqueIds.get(d.path) : this.id)

  arcs.exit()
    .remove()

  const arcsEnter = arcs.enter()
    .append('path')
    .attr('id', d => 'arc-' + arcUniqueIds.get(d.path))
    .attr('fill', d => {
      d = d.object
      while (d.depth > 1) { d = d.parent }
      return color(d.name)
    })
    .on('click', clicked)

  const arcsEnterTitle = arcsEnter.append('title')

  arcsMerge = arcs.merge(arcsEnter)

  arcsMerge.classed('zoomable', d => (d.object.children))

  // Tooltips (no transition)
  arcs.select('title')
    .merge(arcsEnterTitle)
    .text(d => `${d.path}\n${format(d.object.value)}`)

  // some defs to use to clip the text to arcs
  const clipPaths = defs.selectAll('clipPath')
    .data(D3DataArray, (d) => d ? 'clippath-' + arcUniqueIds.get(d.path) : this.id)

  clipPaths.exit()
    .remove()

  const clipPathsEnter = clipPaths.enter()
    .append('clipPath')
    .attr('id', d => 'clippath-' + arcUniqueIds.get(d.path))

  clipPathsEnter.append('path')

  clipPathsMerge = clipPaths.merge(clipPathsEnter)

  // We use a G to set the clip path
  const label = labelG.selectAll('g')
    .data(D3DataArray, (d) => d ? 'label-' + arcUniqueIds.get(d.path) : this.id)

  label.exit()
    .remove()

  const labelEnter = label.enter()
    .append('g')
    .attr('id', d => 'label-' + arcUniqueIds.get(d.path))
    .style('clip-path', d => `url(#${'clippath-' + arcUniqueIds.get(d.path)})`)

  // Now we can use Text with a transform - otherwise the transform applies to the clip path and nothing appears
  labelEnter.append('text')
    .attr('dy', '0.35em')

  labelMerge = label.merge(labelEnter)

  labelMerge.select('text').text(d => d.object.name + (config.showValueOnLabel ? (' (' + format(d.object.value) + ')') : ''))

  // Enable or disable zoom (do this last so that we can us zoomable class)
  enableDisableZoom(config.allowZoom)

  transitionEverything(currentCenter, 1000)
}

// At the end of the transition the 'current' values will have transitioned to match the 'target'
// allowing us to use them for the next set of transitions
function transitionEverything (currentCenter, duration) {
  // Recalculate the target position based on current object at the center
  currentCenterPath = currentCenter.path
  D3data.forEach(d => {
    d.object.target = {
      x0: Math.max(0, Math.min(1, (d.object.x0 - currentCenter.x0) / (currentCenter.x1 - currentCenter.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.object.x1 - currentCenter.x0) / (currentCenter.x1 - currentCenter.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.object.y0 - currentCenter.depth),
      y1: Math.max(0, d.object.y1 - currentCenter.depth)
    }
  })

  // Transition the data on all arcs, even the ones that aren’t visible,
  // so that if this transition is interrupted, entering arcs will start
  // the next transition from the desired position.
  const mainTransition = d3.select('#js_chart').transition('main').duration(duration)
  const markingTransition = d3.select('#js_chart').transition('marking').duration(200)

  arcsMerge.transition(mainTransition)
    .tween('data', d => {
      const i = d3.interpolate(d.object.current, d.object.target)
      return t => { d.object.current = i(t) }
    })
    .filter(function (d) {
      return +this.getAttribute('fill-opacity') || arcVisible(d.object.target)
    })
    .attrTween('d', d => () => arc(d.object.current))

  arcsMerge.transition(markingTransition)
    .attr('fill-opacity', d => arcOpacity(d.object, d.object.target))

  // Transition label paths (not that object.current is 'tweened' by the arc transition)
  clipPathsMerge.transition(mainTransition)
    .select('path')
    .attrTween('d', d => () => arc(d.object.current))

  // Transition for labels
  labelMerge.transition(mainTransition)
    .select('text')
    .attr('fill-opacity', d => labelVisible(d.object.target) ? 1 : 0)
    .attr('transform', d => labelTransform(d.object.target))
    .style('font-weight', d => d.object.marked ? 'bold' : '')
}

function clicked (p) {
  currentEvent.stopPropagation()
  // check for marking or zoom
  if (zoomMode === 'mark') {
    var markData = { markMode: JSVizHelper.getMarkMode(currentEvent), indexSet: p.object.indices }
    window.markIndices(markData)
  } else {
    // Grab the actual object
    p = p.object
    // Check if we clicked on the center
    if ((p.current.y0 === 0) || ((p.target) && (p.target.y0 === 0))) {
      p = p.parent
    }
    // zooming only available for arcs with children (or center if all children have been filtered out)
    if (p.children) {
      transitionEverything(p, 500)
    }
  }
}

// Only visible if in first n levels or zoom off
function arcVisible (d) {
  return (!lastConfig.allowZoom || (d.y1 <= (lastConfig.levelsVisible + 1))) && d.y0 >= 0 && d.x1 > d.x0
}

// Only visible if in first n levels or zoom off and it's a reasonably large arc
function labelVisible (d) {
  return (!lastConfig.allowZoom || (d.y1 <= (lastConfig.levelsVisible + 1) && d.y0 >= 0)) && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
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

// Called when an area has been selected for marking.
function markLasso (markMode, rectangle) {
  // The logic we use is to calculate where the rectangle intersects with circles drawn at each level
  // then look at whether a particular arc falls inside the rectangle or not based on the intersection angles

  // First transform the coordinates of the rectangle such that (0,0) is the center of the chart
  // and x/y are expressed in terms of the level (0 at center, 1 edge of inner circle, 2 outer edge of first layer of arcs etc.)
  // Y axis upwards. (x0,y0) is bottom left, (x1,y1) is top right
  const rect = {
    x0: (rectangle.x - center.x) / levelRadius,
    x1: (rectangle.x + rectangle.width - center.x) / levelRadius,
    y0: -(rectangle.y + rectangle.height - center.y) / levelRadius,
    y1: -(rectangle.y - center.y) / levelRadius
  }

  // Now loop over all our circles figuring out intersection points
  const levelInfo = []
  for (var level = 0; level <= totalLevelsVisible + 1; level++) {
    const thisLevelInfo = {
      allOutside: false,
      allInside: false,
      intersectAngles: []
    }

    // Note that level 0 will either be all inside or all ourside, so no need to worry about division by zero problems when looking for intersects
    if ((rect.x0 <= -level) && (rect.x1 >= level) && (rect.y0 <= -level) && (rect.y1 >= level)) {
      thisLevelInfo.allInside = true
    } else if ((Math.sqrt(Math.pow(rect.x0, 2) + Math.pow(rect.y0, 2)) <= level) &&
               (Math.sqrt(Math.pow(rect.x0, 2) + Math.pow(rect.y1, 2)) <= level) &&
               (Math.sqrt(Math.pow(rect.x1, 2) + Math.pow(rect.y0, 2)) <= level) &&
               (Math.sqrt(Math.pow(rect.x1, 2) + Math.pow(rect.y1, 2)) <= level)) {
      // This finds the trivial case where the rectangle is enclosed by the circle.
      // We'll pick up the case where the rectangle is outside the circle but doesn't intersect in the next section of code
      thisLevelInfo.allOutside = true
    } else {
      // Helper to check if a line segment intersects the circle
      const checkIntersect = (linePos, lineStart, lineEnd, angleFunc, negativeAngle, posInside) => {
        const intersect = Math.sqrt(Math.pow(level, 2) - Math.pow(linePos, 2))
        if ((intersect >= lineStart) && (intersect <= lineEnd)) {
          thisLevelInfo.intersectAngles.push({
            angle: angleFunc(linePos / level),
            inside: posInside
          })
        }
        if ((-intersect >= lineStart) && (-intersect <= lineEnd)) {
          thisLevelInfo.intersectAngles.push({
            angle: negativeAngle - angleFunc(linePos / level),
            inside: !posInside
          })
        }
      }
      checkIntersect(rect.x0, rect.y0, rect.y1, Math.asin, Math.PI, true)
      checkIntersect(rect.x1, rect.y0, rect.y1, Math.asin, Math.PI, false)
      checkIntersect(rect.y0, rect.x0, rect.x1, Math.acos, Math.PI * 2, false)
      checkIntersect(rect.y1, rect.x0, rect.x1, Math.acos, Math.PI * 2, true)

      // We want an array where angles are between 0 and 2*PI, sorted into order, with extra elements at the start/end for 0 and 2*PI to make check loops simpler
      if (thisLevelInfo.intersectAngles.length === 0) {
        thisLevelInfo.allOutside = true
      } else {
        thisLevelInfo.intersectAngles.forEach(d => {
          if (d.angle < 0) {
            d.angle = d.angle + 2 * Math.PI
          }
        })
        thisLevelInfo.intersectAngles.sort((a, b) => a.angle - b.angle)
        thisLevelInfo.intersectAngles.unshift({
          angle: 0,
          inside: !thisLevelInfo.intersectAngles[0].inside
        })
        thisLevelInfo.intersectAngles.push({
          angle: 2 * Math.PI,
          inside: thisLevelInfo.intersectAngles[0].inside
        })
      }
    }

    levelInfo.push(thisLevelInfo)
  }

  // Check if an arc falls completely inside the rectangle
  function arcInside (angle0, angle1, radius) {
    // Allow for rounding errors in angle calculations
    if ((radius > totalLevelsVisible + 1) || levelInfo[radius].allOutside || (angle1 <= angle0 + Math.pow(10, -6))) {
      return false
    } else if (levelInfo[radius].allInside) {
      return true
    } else {
      var intersect = 0
      while ((levelInfo[radius].intersectAngles[intersect + 1].angle < angle0)) {
        intersect++
      }
      // We're inside if angle0 is inside and angle1 comes before the next rectangle intersection
      return levelInfo[radius].intersectAngles[intersect].inside && (levelInfo[radius].intersectAngles[intersect + 1].angle >= angle1)
    }
  }

  // Search all object data to check if arcs within the rectangle
  var markData = { markMode: markMode, indexSet: [] }
  arcG.selectAll('path').each(function (d) {
    if ((d.object.current.y1 > 0) && arcInside(d.object.current.x0, d.object.current.x1, d.object.current.y0) && arcInside(d.object.current.x0, d.object.current.x1, d.object.current.y1)) {
      markData.indexSet = markData.indexSet.concat(d.object.indices)
    }
  })

  // We want unique indices
  // eslint-disable-next-line no-undef
  markData.indexSet = [...new Set(markData.indexSet)]

  window.markIndices(markData)
}
