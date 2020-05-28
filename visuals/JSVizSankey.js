// Visualise using a Sankey Chart
// Note that the d3-sankey library doesn't support IE, so we're not going to support IE either

import { event as currentEvent } from 'd3-selection'

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')

var d3 = _.extend({}, require('d3-array'), require('d3-color'), require('d3-collection'), require('d3-drag'), require('d3-format'), require('d3-path'), require('d3-sankey'), require('d3-scale'), require('d3-selection'), require('d3-shape'), require('d3-zoom'))

var $ = require('jquery')

var parent
var svg
var margin = { left: 10, right: 10, top: 10, bottom: 10 }
var size = { width: 0, height: 0 }

var defaultConfig = {
  tooltipFormat: 'Name: %n\nTotal value: %v',
  labelFormat: '%n',
  linkTooltipFormat: '%0 - %1 (%v)',
  linkColour: 'inputToOutput',
  valueFormat: 'g',
  nodeWidth: 15,
  nodePadding: 10,
  nodeAlign: 'sankeyJustify',
  allowNodeDrag: false,
  colourFromColumn: 0,
  colourToColumn: 1,
  sortNodesByValue: true,
  sortNodesReverse: false,
  sortFromColumn: 0,
  sortToColumn: 1
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  renderOnResize: true,
  mark: {
    selector: '#js_chart svg',
    type: JSVizHelper.markType.svg
  },
  configuratorTitle: 'Sankey Chart options',
  configuratorInstructions: [
    '<p>The Sankey chart requires a single table containing a list of "from" nodes, "to" nodes and the value of the link between them.',
    'Rows can optionally include other columns that can be used for tooltips and labels.</p>',
    '<p>When specifying label and tooltip formats you can use %0, %1, %2 etc. to reference columns in the table, %n to reference the node name and %v the node value (the total of all associated link values).</p>'
  ],
  configOptions: [
    {
      caption: 'Node tooltip format',
      type: 'multiline',
      name: 'tooltipFormat',
      tab: 'Axes'
    },
    {
      caption: 'Node label format',
      type: 'multiline',
      name: 'labelFormat',
      tab: 'Axes'
    },
    {
      caption: 'Link tooltip format',
      type: 'multiline',
      name: 'linkTooltipFormat',
      tab: 'Axes'
    },
    {
      caption: "Numeric format definition when showing the value for a link/node. Formats are specified using D3's library (<a href='https://github.com/d3/d3-format'>here</a>)",
      type: 'text',
      name: 'valueFormat',
      tab: 'Axes'
    },
    {
      caption: 'Colour to use on links',
      type: 'select',
      name: 'linkColour',
      tab: 'Axes',
      options: [
        { value: 'inputToOutput', text: 'Gradient from input colour to output colour' },
        { value: 'none', text: 'None' },
        { value: 'input', text: 'Input node colour' },
        { value: 'output', text: 'Output node colour' }
      ]
    },
    {
      caption: 'Column to use to categorize the "From" values for colouring',
      type: 'column-number',
      name: 'colourFromColumn',
      tab: 'Axes'
    },
    {
      caption: 'Column to use to categorize the "To" values for colouring',
      type: 'column-number',
      name: 'colourToColumn',
      tab: 'Axes'
    },
    {
      caption: 'Node alignment',
      type: 'select',
      name: 'nodeAlign',
      tab: 'Appearance',
      options: [
        { value: 'sankeyJustify', text: 'Justify' },
        { value: 'sankeyLeft', text: 'Left' },
        { value: 'sankeyRight', text: 'Right' },
        { value: 'sankeyCenter', text: 'Center' }
      ]
    },
    {
      caption: 'Node width (pixels)',
      type: 'number',
      name: 'nodeWidth',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    },
    {
      caption: 'Node padding (pixels)',
      type: 'number',
      name: 'nodePadding',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    },
    {
      caption: 'Allow node dragging',
      type: 'checkbox',
      name: 'allowNodeDrag',
      tab: 'Appearance'
    },
    {
      caption: 'Sort nodes by value',
      type: 'checkbox',
      name: 'sortNodesByValue',
      tab: 'Node ordering'
    },
    {
      caption: 'Reverse sort?',
      type: 'checkbox',
      name: 'sortNodesReverse',
      tab: 'Node ordering',
      enabledIfChecked: 'sortNodesByValue'
    },
    {
      caption: 'Column to use when sorting "From" nodes',
      type: 'column-number',
      name: 'sortFromColumn',
      tab: 'Node ordering',
      enabledIfChecked: 'sortNodesByValue'
    },
    {
      caption: 'Column to use when sorting "To" nodes',
      type: 'column-number',
      name: 'sortToColumn',
      tab: 'Node ordering',
      enabledIfChecked: 'sortNodesByValue'
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
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .style('isolation', 'isolate')
}

// Main render method
function render (data, config) {
  // Figure out size
  size.width = parent.innerWidth() - margin.left - margin.right
  size.height = parent.innerHeight() - margin.top - margin.bottom

  // Check for a valid data configuration
  if ((data.additionalTables.length !== 0) || (data.columns.length < 3)) {
    JSVizHelper.showMessageInstead('Invalid data configuration. You need to define a single table that contains a list of "from" and "to" nodes, along with the value of the link')
    return
  }

  // Update the default fill color (particularly for text) in case theme changes
  svg.attr('fill', $('body').css('color'))

  // Clear out any previous chart
  svg.selectAll('*').remove()

  // Create a data array for nodes
  var anyMarked = false
  var nodeData = _.reduce(data.data, function (result, d) {
    if ((d.items[2] || 0) > 0) {
      for (var inOut = 0; inOut < 2; inOut++) {
        var newNode = {}
        _.extend(newNode, {
          id: d.items[inOut],
          tooltip: config.tooltipFormat,
          label: config.labelFormat,
          dataIds: [d.hints.index],
          marked: d.hints.marked,
          colour: d.items[inOut === 0 ? config.colourFromColumn : config.colourToColumn],
          sort: d.items[inOut === 0 ? config.sortFromColumn : config.sortToColumn]
        })
        anyMarked = anyMarked || newNode.marked
        _.each(d.items, function (value, index) {
          newNode.tooltip = newNode.tooltip.replace('%' + index, value)
          newNode.label = newNode.label.replace('%' + index, value)
        })
        newNode.tooltip = newNode.tooltip.replace('%n', newNode.id)
        newNode.label = newNode.label.replace('%n', newNode.id)
        var existing = _.findWhere(result, { id: newNode.id })
        if (existing) {
          existing.dataIds.push(newNode.dataIds[0])
          existing.marked = existing.marked || newNode.marked
        } else {
          result.push(newNode)
        }
      }
    }
    return result
  }, [])

  // Check for an empty visual
  if (nodeData.length === 0) {
    JSVizHelper.showMessageInstead('No data to show')
    return
  }

  // Create an array in the right format for links
  var linkData = _.reduce(data.data, function (result, d) {
    var newLink = { source: _.findWhere(nodeData, { id: d.items[0] }), target: _.findWhere(nodeData, { id: d.items[1] }), value: (d.items[2] || 0), dataId: d.hints.index, marked: d.hints.marked }
    // Only add the link if both nodes are in the data (to support filtering on Nodes within Spotfire)
    if ((newLink.source !== undefined) && (newLink.target !== undefined) && (newLink.value > 0)) {
      anyMarked = anyMarked || newLink.marked
      _.extend(newLink, { tooltip: config.linkTooltipFormat })
      _.each(d.items, function (value, index) {
        newLink.tooltip = newLink.tooltip.replace('%' + index, value)
      })
      result.push(newLink)
    }
    return result
  }, [])

  // Grab unique values used for colouring
  var colourDomain = _.uniq(_.map(nodeData, d => d.colour))

  var colour = function (colour) {
    return d3.scaleOrdinal(d3.schemeCategory20).domain(colourDomain)(colour)
  }

  // Now draw the charts
  var sankey = d3.sankey()
    .nodes(nodeData)
    .links(linkData)
    .nodePadding(config.nodePadding)
    .nodeWidth(config.nodeWidth)
    .size([size.width, size.height])
    .nodeAlign(d3[config.nodeAlign])

  if (config.sortNodesByValue) {
    sankey.nodeSort((a, b) => {
      var answer
      if (typeof a.sort === 'string') {
        answer = (a.sort + '').localeCompare(b.sort)
      } else {
        answer = a.sort - b.sort
      }
      if (config.sortNodesReverse) answer = -answer
      return answer
    })
  }

  var graph = sankey()

  // Handle colour gradients
  if (config.linkColour === 'inputToOutput') {
    var gradient = svg.append('defs')
      .selectAll('.linkGradient')
      .data(graph.links)
      .join('linearGradient')
      .attr('id', d => 'link-gradient-' + d.index)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', d => d.source.x1)
      .attr('x2', d => d.target.x0)

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', d => colour(d.source.colour))

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', d => colour(d.target.colour))
  }

  // add in the links
  var link = svg.append('g')
    .attr('fill', 'none')
    .attr('stroke', '#000')
    .selectAll('.link')
    .data(graph.links)
    .join('path')
    .attr('class', 'link')
    .attr('stroke-opacity', (d) => !anyMarked ? 0.4 : d.marked ? 0.4 : 0.1)
    .style('mix-blend-mode', 'multiply')
    .attr('d', d3.sankeyLinkHorizontal())
    .style('stroke-width', d => d.width)
    .attr('stroke', d => config.linkColour === 'none' ? '#aaa'
      : config.linkColour === 'inputToOutput' ? 'url(#link-gradient-' + d.index + ')'
        : config.linkColour === 'input' ? colour(d.source.colour)
          : colour(d.target.colour))
    .sort((a, b) => b.width - a.width)
    .on('click', (selected) => {
      currentEvent.stopPropagation()
      window.markIndices({ markMode: JSVizHelper.getMarkMode(currentEvent), indexSet: [selected.dataId] })
    })

  // Add hover text
  link.append('title')
    .text(d => d.tooltip.replace('%v', d3.format(config.valueFormat)(d.value)))

  // add in the nodes
  var node = svg.append('g')
    .selectAll('.node')
    .data(graph.nodes)
    .enter().append('g')
    .attr('class', 'node')
    .attr('transform', d => 'translate(' + d.x0 + ',' + d.y0 + ')')

  if (config.allowNodeDrag) {
    node.call(d3.drag()
      .subject(d => d)
      .on('start', function () { this.parentNode.appendChild(this) }) // Make sure the node appears on top of others
      .on('drag', function (d) {
        // the function for moving the nodes - keeping within the boundary of the chart
        d.screenHeight = d.screenHeight || (d.y1 - d.y0)
        d3.select(this)
          .attr('transform', 'translate(' + d.x0 + ',' + (d.y0 = Math.max(0, Math.min(size.height - d.screenHeight, currentEvent.y))) + ')')
        sankey.update(graph)
        link.attr('d', d3.sankeyLinkHorizontal())
      }))
  }

  // add the rectangles for the nodes
  node
    .append('rect')
    .attr('height', d => d.y1 - d.y0)
    .attr('width', sankey.nodeWidth())
    .style('fill', d => colour(d.colour))
    .attr('fill-opacity', (d) => !anyMarked ? 1.0 : d.marked ? 1.0 : 0.2)
    .attr('stroke-opacity', (d) => !anyMarked ? 1.0 : d.marked ? 1.0 : 0.2)
    .style('stroke', d => d3.rgb(colour(d.colour)).darker(2))
    .attr('data-id-array', d => JSON.stringify(d.dataIds))
  // Add hover text
    .append('title')
    .text(d => d.tooltip.replace('%v', d3.format(config.valueFormat)(d.value)))

  // add in the title for the nodes
  node.append('text')
    .attr('x', -6)
    .attr('y', d => (d.y1 - d.y0) / 2)
    .attr('dy', '.35em')
    .attr('text-anchor', 'end')
    .attr('transform', null)
    .text(d => d.label.replace('%v', d3.format(config.valueFormat)(d.value)))
    .filter(d => d.x0 < size.width / 2)
    .attr('x', 6 + sankey.nodeWidth())
    .attr('text-anchor', 'start')
}
