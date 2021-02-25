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
// eslint-disable-next-line no-undef
var arcUniqueIds = new Map()
var colourDomain = []

var defaultConfig = {
  valueFormat: ',d',
  allowZoom: true,
  levelsVisible: 3
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  configButton: JSVizHelper.configButton.gearRight,
  firstTimeSetup: firstTimeSetup,
  render: render,
  renderOnResize: true,
  mark: {
    type: JSVizHelper.markType.none
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

  outerG = svg.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .style('isolation', 'isolate')

  arcG = outerG.append('g')
  labelG = outerG.append('g')
    .attr('pointer-events', 'none')
    .attr('text-anchor', 'middle')
    .style('user-select', 'none')

  defs = svg.append('defs')
}

// Main render method
function render (data, config) {
  // Update the default fill color (particularly for text) in case theme changes
  svg.attr('fill', $('body').css('color'))

  // Convert the data into d3 hierarchical form
  // We assume that the last column in the data is the numeric value to use for the size
  // and that all other columns are text representing the hierarchy
  // We will automatically roll up multiple rows with matching hierarchy values
  const columnCount = data.columns.length
  const grouping = Array.from(Array(columnCount - 1).keys()).map(x => d => { return d.items[x] })
  const group = d3.rollup(data.data, v => { return { hints: v.map(x => x.hints.index), value: v.reduce((a, b) => a + b.items[columnCount - 1], 0) } }, ...grouping)
  var root = d3.hierarchy(group)

  // Now simplify the hierarchy object - ensure each node has:
  // name - the text to show
  // hints - an array of row hints for marking
  // value - the total value of all rows within the node
  root.each(d => {
    d.current = d
    d.name = d.data[0]
    d.path = d.ancestors().map(d => d.name).reverse().join('/').substr(1)
    if (d.children) {
      const answer = d.leaves().reduce((a, b) => {
        a.hints = a.hints.concat(b.data[1].hints)
        a.value = a.value + b.data[1].value
        return a
      }, { hints: [], value: 0 })
      d.hints = answer.hints
      d.value = answer.value
    } else {
      d.hints = d.data[1].hints
      d.value = d.data[1].value
    }
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
  const radius = Math.min(size.width, size.height) / ((config.allowZoom ? config.levelsVisible : root.height) + 1) / 2

  // Coordinates are (0,0) at the center of the SVG
  outerG.attr('transform', `translate(${size.width / 2 + margin.left},${size.height / 2 + margin.top})`)

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
    .padRadius(radius * 1.5)
    .innerRadius(d => d.y0 * radius)
    .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1))

  // Draw the chart
  const mainTransition = d3.select('#js_chart').transition('main').duration(1000)
  // const markingTransition = d3.select('#js_chart').transition('marking').duration(200)

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
    .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
    .attr('d', d => arc(d.current))

  const arcsEnterTitle = arcsEnter.append('title')

  const arcsMerge = arcs.merge(arcsEnter)

  // We only transition those that already exist
  arcs.transition(mainTransition)
    .attr('fill-opacity', d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
    .attr('d', d => arc(d.current))

  // Show pointer when the user can click to zoom
  arcsMerge.filter(d => (config.allowZoom && d.children))
    .style('cursor', 'pointer')
    .on('click', clicked)
  arcsMerge.filter(d => !(config.allowZoom && d.children))
    .style('cursor', '')
    .on('click', null)

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
    // Check if we clicked on the center
    if ((p.target) && (p.target.y0 === 0)) {
      p = p.parent
    }

    root.each(d => {
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
      .attr('fill-opacity', d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
      .attrTween('d', d => () => arc(d.current))

    // Transition for labels when we click
    labelTextMerge.filter(function (d) {
      return +this.getAttribute('fill-opacity') || labelVisible(d.target)
    }).transition(clickTransition)
      .attr('fill-opacity', d => +labelVisible(d.target))
      .attr('transform', d => labelTransform(d.target))
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
      const y = (d.y0 + d.y1) / 2 * radius
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`
    }
  }
}
