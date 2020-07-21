/* eslint-disable compat/compat */
// Visualise using a Sankey Chart
// Note that the d3-sankey library doesn't support IE, so we're not going to support IE either

import { event as currentEvent } from 'd3-selection'

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')

var d3 = _.extend({}, require('d3-array'), require('d3-color'), require('d3-collection'), require('d3-format'), require('d3-path'), require('d3-sankey'), require('d3-sankey-circular'), require('d3-scale'), require('d3-selection'), require('d3-shape'), require('d3-zoom'), require('d3-scale-chromatic'))

var $ = require('jquery')

var parent
var svg
var nodeGroup
var linkGroup
var gradientDefs
var nodeData = []
var linkData = []
// eslint-disable-next-line no-undef
var linkUniqueIds = new Map()
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
  colourFromColumn: 0,
  colourToColumn: 1,
  sortNodesByValue: true,
  sortNodesReverse: false,
  sortFromColumn: 0,
  sortToColumn: 1,
  allowCircular: false
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
      caption: "Numeric format definition when showing the value for a link/node. Formats are specified using D3's library (<a href='https://github.com/d3/d3-format' target='_blank'>here</a>)",
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
      caption: 'Allow circular links (appearance will change, sorting isn\'t supported)',
      type: 'checkbox',
      name: 'allowCircular',
      tab: 'Appearance'
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
      caption: 'Sort nodes by value',
      type: 'checkbox',
      name: 'sortNodesByValue',
      tab: 'Node ordering',
      disabledIfChecked: 'allowCircular'
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

  nodeGroup = svg.append('g')

  linkGroup = svg.append('g')
    .attr('fill', 'none')
    .attr('stroke', '#000')

  gradientDefs = svg.append('defs')
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

  // Create a data array for nodes
  var anyMarked = false

  // Firstly, we clear attributes that may have changed from the previous set of nodes
  nodeData.map((node) => {
    node.marked = false
    node.dataIds = []
    node.foundInNewData = false
  })

  nodeData = _.reduce(data.data, function (result, d) {
    if ((d.items[2] || 0) > 0) {
      for (var inOut = 0; inOut < 2; inOut++) {
        var newNode = {}
        _.extend(newNode, {
          id: d.items[inOut],
          foundInNewData: true,
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
          // Merge data into the existing node
          existing.foundInNewData = true
          existing.tooltip = newNode.tooltip
          existing.dataIds.push(newNode.dataIds[0])
          existing.label = newNode.label
          existing.marked = existing.marked || newNode.marked
          existing.colour = newNode.colour
          existing.sort = newNode.sort
        } else {
          result.push(newNode)
        }
      }
    }
    return result
  }, [])
  // Now remove any nodes that are no longer present in the data
  nodeData = nodeData.filter((node) => node.foundInNewData)

  // Check for an empty visual
  if (nodeData.length === 0) {
    JSVizHelper.showMessageInstead('No data to show')
    return
  }

  // Create an array in the right format for links
  linkData.map((link) => { link.foundInNewData = false })
  linkData = _.reduce(data.data, function (result, d) {
    const from = d.items[0]
    const to = d.items[1]

    var newLink = {
      id: from + '>' + to,
      source: _.findWhere(nodeData, { id: from }),
      target: _.findWhere(nodeData, { id: to }),
      value: (d.items[2] || 0),
      foundInNewData: true,
      dataId: d.hints.index,
      marked: d.hints.marked
    }
    // Only add the link if both nodes are in the data (to support filtering on Nodes within Spotfire)
    if ((newLink.source !== undefined) && (newLink.target !== undefined) && (newLink.value > 0)) {
      anyMarked = anyMarked || newLink.marked
      _.extend(newLink, { tooltip: config.linkTooltipFormat })
      _.each(d.items, function (value, index) {
        newLink.tooltip = newLink.tooltip.replace('%' + index, value)
      })

      const existing = result.find(({ source, target }) => source === newLink.source && target === newLink.target)
      if (existing) {
        // Update an existing element rather than build a new one
        existing.value = newLink.value
        existing.foundInNewData = true
        existing.dataId = newLink.dataId
        existing.marked = newLink.marked
        existing.tooltip = newLink.tooltip
      } else {
        result.push(newLink)
      }
    }
    return result
  }, [])

  // Now remove any links that are no longer present in the data
  linkData = linkData.filter((link) => link.foundInNewData)

  // generate link Ids for DOM use
  linkData.map((link) => {
    if (!linkUniqueIds.has(link.id)) {
      linkUniqueIds.set(link.id, linkUniqueIds.size)
    }
  })

  // Grab unique values used for colouring
  var colourDomain = _.uniq(_.map(nodeData, d => d.colour))

  var colour = function (colour) {
    return d3.scaleOrdinal(d3.schemeCategory10).domain(colourDomain)(colour)
  }

  // Now draw the charts
  var sankey = (config.allowCircular ? d3.sankeyCircular() : d3.sankey())
    .nodes(nodeData)
    .links(linkData)
    .nodePadding(config.nodePadding)
    .nodeWidth(config.nodeWidth)
    .size([size.width, size.height])
    .nodeAlign(d3[config.nodeAlign])
    .iterations(32)

  if (config.sortNodesByValue && !config.allowCircular) {
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

  // Get the graph and set up transitions to be synched
  const graph = sankey()
  const mainTransition = d3.select('#js_chart').transition('main').duration(1300)
  const markingTransition = d3.select('#js_chart').transition('marking').duration(200)

  // Handle colour gradients
  if (config.linkColour === 'inputToOutput') {
    const gradient = gradientDefs.selectAll('.linkGradient')
      .data(graph.links, (d) => d.id)

    gradient.exit().remove()

    const gradientStop0 = gradient.select('.linkGradientStop0')
    const gradientStop100 = gradient.select('.linkGradientStop100')

    const gradientEnter = gradient.enter()
      .append('linearGradient')
      .attr('class', 'linkGradient')
      .attr('id', d => 'link-gradient-' + linkUniqueIds.get(d.id))
      .attr('gradientUnits', 'userSpaceOnUse')

    gradient.merge(gradientEnter)
      .transition(mainTransition)
      .attr('x1', d => d.source.x1)
      .attr('x2', d => d.target.x0)

    const gradientStop0Enter = gradientEnter.append('stop')
      .attr('class', 'linkGradientStop0')
      .attr('offset', '0%')

    gradientStop0.merge(gradientStop0Enter)
      .transition(mainTransition)
      .attr('stop-color', d => colour(d.source.colour))

    const gradientStop100Enter = gradientEnter.append('stop')
      .attr('class', 'linkGradientStop100')
      .attr('offset', '100%')

    gradientStop100.merge(gradientStop100Enter)
      .transition(mainTransition)
      .attr('stop-color', d => colour(d.target.colour))
  }

  // add in the links
  const link = linkGroup.selectAll('.link')
    .data(graph.links, (d) => d.id)

  link.exit()
    .transition(mainTransition)
    .style('stroke-width', 0)
    .remove()

  // New links start at width 0 and grow out
  const linkEnter = link.enter().append('path')
    .attr('class', 'link')
    .style('stroke-width', 0)
    .on('click', (selected) => {
      currentEvent.stopPropagation()
      window.markIndices({ markMode: JSVizHelper.getMarkMode(currentEvent), indexSet: [selected.dataId] })
    })

  // Handle marking
  link.merge(linkEnter)
    .transition(markingTransition)
    .attr('stroke-opacity', (d) => !anyMarked ? 0.4 : d.marked ? 0.4 : 0.1)

  // Animate the rest of the attributes
  link.merge(linkEnter)
    .transition(mainTransition)
    .attr('d', d => config.allowCircular ? d.path : d3.sankeyLinkHorizontal()(d))
    .style('stroke-width', d => d.width)

  // attributes that we don't want to animate
  link.merge(linkEnter)
    .style('mix-blend-mode', 'multiply')
    .attr('stroke', d => config.linkColour === 'none' ? '#aaa'
      : config.linkColour === 'inputToOutput' ? 'url(#link-gradient-' + linkUniqueIds.get(d.id) + ')'
        : config.linkColour === 'input' ? colour(d.source.colour)
          : colour(d.target.colour))
    .sort((a, b) => b.width - a.width)

  // Add hover text
  const linkTitleEnter = linkEnter.append('title')
  link.select('title').merge(linkTitleEnter)
    .text(d => d.tooltip.replace('%v', d3.format(config.valueFormat)(d.value)))

  // add in the nodes
  const node = nodeGroup.selectAll('.node')
    .data(graph.nodes, (d) => d.id)

  node.exit().remove()

  const nodeEnter = node.enter().append('g')
    .attr('class', 'node')
    .attr('transform', d => 'translate(' + (d.x0 + d.x1) / 2 + ',' + (d.y0 + d.y1) / 2 + ')')
    .attr('height', 0)

  node.merge(nodeEnter)
    .transition(mainTransition)
    .attr('transform', d => 'translate(' + d.x0 + ',' + d.y0 + ')')
    .attr('height', d => d.y1 - d.y0)

  // add the rectangles for the nodes
  const nodeRect = node.select('rect')
  const nodeRectEnter = nodeEnter
    .append('rect')
    .attr('width', sankey.nodeWidth())

  nodeRect.merge(nodeRectEnter)
    .transition(markingTransition)
    .attr('fill-opacity', (d) => !anyMarked ? 1.0 : d.marked ? 1.0 : 0.2)
    .attr('stroke-opacity', (d) => !anyMarked ? 1.0 : d.marked ? 1.0 : 0.2)

  nodeRect.merge(nodeRectEnter)
    .attr('data-id-array', d => JSON.stringify(d.dataIds))
    .transition(mainTransition)
    .attr('width', sankey.nodeWidth())
    .attr('height', d => d.y1 - d.y0)
    .attr('width', sankey.nodeWidth())
    .style('fill', d => d3.rgb(colour(d.colour)))
    .style('stroke', d => d3.rgb(colour(d.colour)).darker(2))

  // add in the title for the nodes
  const nodeText = node.select('text')

  const nodeTextEnter = nodeEnter.append('text')
    .attr('dy', '.35em')
    .attr('transform', null)
    .style('cursor', 'default')
    .attr('x', d => (d.x0 < size.width / 2) ? 6 + sankey.nodeWidth() : -6)

  nodeText.merge(nodeTextEnter)
    .attr('text-anchor', d => (d.x0 < size.width / 2) ? 'start' : 'end')
    .text(d => d.label.replace('%v', d3.format(config.valueFormat)(d.value)))
    .transition(mainTransition)
    .attr('y', d => (d.y1 - d.y0) / 2)
    .attr('x', d => (d.x0 < size.width / 2) ? 6 + sankey.nodeWidth() : -6)

  // Add hover text
  nodeRect.select('title')
    .merge(nodeRectEnter.append('title'))
    .text(d => d.tooltip.replace('%v', d3.format(config.valueFormat)(d.value)))
}
