// Visualise using a Word Cloud
// Based on http://bl.ocks.org/jwhitfieldseed/9697914 with significant updates to support Spotfire, resizing, marking, configuration etc.

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')

var d3 = _.extend({}, require('d3-selection'), require('d3-scale'), require('d3-transition'))

var d3Cloud = require('d3-cloud')

var $ = require('jquery')
require('jquery-ui/ui/widgets/button.js')
require('jquery-ui/themes/base/button.css')

var defaultConfig = {
  maxWords: 1000,
  transitionDuration: 1000,
  removeDuration: 200,
  fontName: 'Impact',
  spiral: 'archimedean',
  padding: 1,
  minimumAngle: -90,
  maximumAngle: 0,
  angleSteps: 2,
  minFontSize: 8,
  maxFontSize: 100,
  scaleType: 'linear',
  scaleOrigin: 'one',
  tooltipFormat: 'Word: "%w". Count: "%c"'
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  mark: {
    selector: '#js_chart svg',
    type: JSVizHelper.markType.svg
  },
  configuratorTitle: 'Word Cloud options',
  configOptions: [
    {
      caption: 'Maximum number of words to show (0 to show all, otherwise highest count words are used)',
      type: 'number',
      name: 'maxWords',
      inputAttributes: {
        min: 0
      }
    },
    {
      caption: 'Number of milliseconds taken to animate into position',
      type: 'number',
      name: 'transitionDuration',
      inputAttributes: {
        min: 0
      }
    },
    {
      caption: 'Number of milliseconds taken to animate removing a word',
      type: 'number',
      name: 'removeDuration',
      inputAttributes: {
        min: 0
      }
    },
    {
      caption: 'Font name',
      type: 'text',
      name: 'fontName'
    },
    {
      caption: 'Pixels to pad between words',
      type: 'number',
      name: 'padding'
    },
    {
      caption: 'Spiral type',
      type: 'select',
      name: 'spiral',
      options: [
        { value: 'archimedean', text: 'Archimedean' },
        { value: 'rectangular', text: 'Rectangular' }
      ]
    },
    {
      caption: 'Minimum angle for text (0 is horizontal)',
      type: 'number',
      name: 'minimumAngle',
      inputAttributes: {
        min: -360,
        max: 360
      }
    },
    {
      caption: 'Maximum angle for text (0 is horizontal)',
      type: 'number',
      name: 'maximumAngle',
      inputAttributes: {
        min: -360,
        max: 360
      }
    },
    {
      caption: 'Rotation steps',
      type: 'number',
      name: 'angleSteps',
      inputAttributes: {
        min: 1
      }
    },
    {
      caption: 'Minimum font size',
      type: 'number',
      name: 'minFontSize',
      inputAttributes: {
        min: 1
      }
    },
    {
      caption: 'Maximum font size',
      type: 'number',
      name: 'maxFontSize',
      inputAttributes: {
        min: 1
      }
    },
    {
      caption: 'Scaling type',
      type: 'select',
      name: 'scaleType',
      options: [
        { value: 'linear', text: 'Linear scale' },
        { value: 'log', text: 'Logarithmic scale (note: not valid for values of 0)' },
        { value: 'sqrt', text: 'Square root scale' }
      ]
    },
    {
      caption: 'Scale origin',
      type: 'select',
      name: 'scaleOrigin',
      options: [
        { value: 'one', text: 'Scale with value of 1 = minimum font size' },
        { value: 'minimum', text: 'Scale with minimum value = minimum font size' }
      ]
    },
    {
      caption: 'Tooltip format (%w will be replaced by the word, %c by the count)',
      type: 'text',
      name: 'tooltipFormat'
    }
  ]
})

var spotfireData = {}
var config = {}
var lastLayoutSize = {}
var lastLayoutConfig = {}
var lastLayoutWords = []
var lastLayoutWordsHT = {}
var svgG
var size
var parent
var redrawButton
var fill = d3.scaleOrdinal(d3.schemeCategory20) // remember the colour used for each word

// Draw the word cloud
function draw (words) {
  var cloud = svgG.selectAll('text')
    .data(words, function (d) { return d.text })

  // Entering words
  var newWords = cloud.enter()
    .append('text')
    .style('fill', function (d, i) { return fill(d.text) })
    .attr('text-anchor', 'middle')
    .style('font-size', 1)
    .text(function (d) { return d.text })
    .attr('transform', 'translate(0,0)rotate(0)')

  // Entering and existing words
  newWords.merge(cloud)
    .style('font-family', function (d) { return d.font })
    .style('font-style', function (d) { return (d.marked ? 'italic' : 'normal') })
    .attr('data-id', function (d) { return d.rowIndex })
    .style('font-family', function (d) { return d.font })
    .transition()
    .on('start', JSVizHelper.pushBusy)
    .on('end', JSVizHelper.popBusy)
    .duration(config.transitionDuration)
    .style('font-size', function (d) { return d.size + 'px' })
    .attr('transform', function (d) {
      return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')'
    })
    .style('fill-opacity', 1)

  // Exiting words
  cloud.exit()
    .transition()
    .on('start', JSVizHelper.pushBusy)
    .on('end', JSVizHelper.popBusy)
    .duration(config.removeDuration)
    .style('fill-opacity', 1e-6)
    .attr('font-size', 1)
    .remove()

  // Tooltips - note that we create the text for the tooltip each time, in case the configuration has changed (otherwise configuration updates would only apply to new words)
  newWords.append('title')

  svgG.selectAll('title').text(function (d) {
    return config.tooltipFormat.replace(/%w/g, d.text).replace(/%c/g, d.count)
  })
}

// Handle window resizing
window.onresize = function (event) {
  // During resize simply move the words around - we don't want to re-render every time since that could get very slow
  size = [parent.innerWidth(), parent.innerHeight()]
  svgG.attr('transform', 'translate(' + size[0] / 2 + ',' + size[1] / 2 + ')')
  redrawButton.show()
}

// Recompute the word cloud for a new set of words or after some other change. This method will
// asycnhronously call draw when the layout has been computed.
function layoutCloud () {
  // We need to copy the data, otherwise the cloud layout stores information in the SpotfireData object that incorrectly caches across rendering events
  // We also use this as an opportunity to see if the only thing that's changing is marking - if so we'll just redraw rather than re-layout
  var words = []
  var wordsHT = {}
  var onlyChangeIsMarking = (JSON.stringify(lastLayoutConfig) === JSON.stringify(config)) && (JSON.stringify(lastLayoutSize) === JSON.stringify(size))
  var minimum = Number.POSITIVE_INFINITY
  var maximum = Number.NEGATIVE_INFINITY
  spotfireData.data.forEach(function (d, i) {
    if ((config.maxWords === 0) || (i < config.maxWords)) {
      words.push({ text: d.items[0], count: d.items[1], rowIndex: d.hints.index, marked: d.hints.marked })
      wordsHT[d.items[0]] = { index: i, count: d.items[1] }
      minimum = Math.min(minimum, d.items[1])
      maximum = Math.max(maximum, d.items[1])
      if (lastLayoutWordsHT.hasOwnProperty(d.items[0])) {
        lastLayoutWords[lastLayoutWordsHT[d.items[0]].index].marked = d.hints.marked // In case we need to redraw the old layout
        onlyChangeIsMarking = onlyChangeIsMarking && (lastLayoutWordsHT[d.items[0]].count === d.items[1])
      } else {
        onlyChangeIsMarking = false
      }
    }
  })

  if (onlyChangeIsMarking) {
    draw(lastLayoutWords)
  } else {
    // Remember for next time
    lastLayoutSize = JSON.parse(JSON.stringify(size))
    lastLayoutConfig = JSON.parse(JSON.stringify(config))
    lastLayoutWordsHT = JSON.parse(JSON.stringify(wordsHT))
    lastLayoutWords = words // keep reference since the layout code will store important information in the object

    // Different mechanisms for scaling
    if (config.scaleOrigin === 'one') { minimum = 1 }
    var scaleFunction = {
      linear: d3.scaleLinear,
      log: d3.scaleLog,
      sqrt: d3.scaleSqrt
    }[config.scaleType]().domain([minimum, maximum]).range([ config.minFontSize, config.maxFontSize ])

    // Now lay it out
    d3Cloud()
      .size(size)
      .words(words)
      .padding(config.padding)
      .font(config.fontName)
      .rotate(function () { return (Math.floor(Math.random() * config.angleSteps)) * (config.maximumAngle - config.minimumAngle) / (config.angleSteps - 1) + config.minimumAngle })
      .spiral(config.spiral)
      .fontSize(function (d) { return scaleFunction(d.count) })
      .text(function (d) { return d.text })
      .on('end', draw)
      .start()
  }
}

// Called the first time (and only the first time) we render
function firstTimeSetup (data, config) {
  var selector = '#js_chart'

  parent = $(selector)
  size = [parent.innerWidth(), parent.innerHeight()]

  // Sometimes words can slightly overflow the space available, so ensure we truncate rather than generate scrollbars
  parent.css('overflow', 'hidden')

  // Construct the word cloud's SVG element
  svgG = d3.select(selector).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .append('g')
    .attr('transform', 'translate(' + size[0] / 2 + ',' + size[1] / 2 + ')')

  // Setup the redraw button (not visible unless the user resizes)
  redrawButton = $('<button>')
    .appendTo(parent)
    .button({
      label: 'Redraw'
    })
    .hide()
    .css('position', 'absolute')
    .css('right', '0')
    .css('top', '0')
    .css('z-index', 999)
    .click(function (event) {
      layoutCloud()
      $(this).hide()
      event.stopPropagation()
    })
    .mousedown(function (event) {
      // Stop JSViz from marking when we click the button
      event.stopPropagation()
    })
}

// Main render method
function render (data, pConfig) {
  spotfireData = data
  config = pConfig
  // Sort the data so we can show the highest scoring
  spotfireData.data.sort(function (a, b) {
    // also ensure always the same order (so if scores match sort alphabetically)
    if (b.items[1] === a.items[1]) {
      return b.items[0].localeCompare(a.items[0])
    } else {
      return b.items[1] - a.items[1]
    }
  })
  layoutCloud()
}
