// A visualisation that show gauges
// Wraps the JustGage library

var JSVizHelper = require('../lib/JSVizHelper.js')
var _ = require('underscore')

var JustGage = require('justgage')

var $ = require('jquery')

var defaultConfig = {
  minGaugeWidth: '200',
  maxGaugeWidth: '200',
  minGaugeHeight: '200',
  maxGaugeHeight: '200',
  donut: false,
  title: '',
  titleFontColor: '#999999',
  titleFontSize: '15',
  label: '',
  labelFontColor: '#b3b3b3',
  hideValue: false,
  valueFontColor: '#010101',
  symbol: '',
  humanFriendly: false,
  humanFriendlyDecimal: 0,
  formatNumber: false,
  decimals: 0,
  gaugeColor: '#ebebeb',
  customSectors: '',
  levelColors: '#ff0000',
  min: 0,
  max: 100,
  reverse: false,
  hideMinMax: false,
  gaugeWidthScale: 1,
  showInnerShadow: true,
  shadowOpacity: 0.2,
  shadowSize: 5,
  shadowVerticalOffset: 3,
  donutStartAngle: 0,
  noGradient: false,
  startAnimationTime: 700,
  startAnimationType: 'linear'
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  mark: { type: JSVizHelper.markType.svg, selector: '.iqvia-mark-rect svg' },
  configuratorTitle: 'Gauge/Donut options',
  configuratorInstructions: [
    '<p>The Gauge allows presentation of a single value in either a Gauge or a Donut. Multiple gauges can be drawn inside the visualisation by providing multiple rows of data.</p>',
    '<p>If your data contains a single column, the gauges will show that column as the value.</p>',
    '<p>More control can be applied to each gauge by providing multiple columns with the column names matching the configuration option names provided in brackets below. ',
    'Parameters provided in the data will override the configuration from this page and the value should be column named "value". E.g. to provide a title and a value you should have two columns named "title" and "value". ',
    'Checkboxes have values of "true" for on, "false" for off. Colors should be provided in rgb format (e.g. #00ff00 for green).</p>'
  ],
  configOptions: [
    {
      tab: 'Main',
      caption: 'Show full donut (donut)',
      type: 'checkbox',
      name: 'donut'
    },
    {
      tab: 'Main',
      caption: 'Title (title)',
      type: 'text',
      name: 'title'
    },
    {
      tab: 'Main',
      caption: 'Title color (titleFontColor)',
      type: 'color',
      name: 'titleFontColor'
    },
    {
      tab: 'Main',
      caption: 'Title font size (titleFontSize',
      type: 'number',
      name: 'titleFontSize',
      inputAttributes: {
        min: 1,
        max: Infinity,
        step: 1
      }
    },
    {
      tab: 'Main',
      caption: 'Minimum value (min)',
      type: 'number',
      name: 'min'
    },
    {
      tab: 'Main',
      caption: 'Maximum value (max)',
      type: 'number',
      name: 'max'
    },
    {
      tab: 'Main',
      caption: 'Hide minimum and maximum value (hideMinMax)',
      type: 'checkbox',
      name: 'hideMinMax'
    },
    {
      tab: 'Main',
      caption: 'Reverse min/max (reverse)',
      type: 'checkbox',
      name: 'reverse'
    },
    {
      tab: 'Sizing',
      caption: 'Minimum gauge width in pixels (minGaugeWidth)',
      type: 'number',
      name: 'minGaugeWidth',
      inputAttributes: {
        min: 1,
        max: Infinity,
        step: 50
      }
    },
    {
      tab: 'Sizing',
      caption: 'Maximum gauge width in pixels (maxGaugeWidth)',
      type: 'number',
      name: 'maxGaugeWidth',
      inputAttributes: {
        min: 50,
        max: Infinity,
        step: 50
      }
    },
    {
      tab: 'Sizing',
      caption: 'Minimum gauge height in pixels (minGaugeHeight)',
      type: 'number',
      name: 'minGaugeHeight',
      inputAttributes: {
        min: 1,
        max: Infinity,
        step: 50
      }
    },
    {
      tab: 'Sizing',
      caption: 'Maximum gauge height in pixels (maxGaugeHeight)',
      type: 'number',
      name: 'maxGaugeHeight',
      inputAttributes: {
        min: 50,
        max: Infinity,
        step: 50
      }
    },
    {
      tab: 'Value',
      caption: 'Value label (label)',
      type: 'text',
      name: 'label'
    },
    {
      tab: 'Value',
      caption: 'Value label color (labelFontColor)',
      type: 'color',
      name: 'labelFontColor'
    },
    {
      tab: 'Value',
      caption: 'Hide the value (hideValue)',
      type: 'checkbox',
      name: 'hideValue'
    },
    {
      tab: 'Value',
      caption: 'Value text color (valueFontColor)',
      type: 'color',
      name: 'valueFontColor',
      disabledIfChecked: 'hideValue'
    },
    {
      tab: 'Value',
      caption: 'Symbol to show after value (symbol)',
      type: 'text',
      name: 'symbol',
      disabledIfChecked: 'hideValue'
    },
    {
      tab: 'Format',
      caption: 'Human friendly format - e.g. 1234567 -> 1.23M (humanFriendly)',
      type: 'checkbox',
      name: 'humanFriendly',
      disabledIfChecked: 'hideValue'
    },
    {
      tab: 'Format',
      caption: 'Number of decimals for human friendly (humanFriendlyDecimal)',
      type: 'number',
      name: 'humanFriendlyDecimal',
      inputAttributes: {
        min: 0,
        max: 10,
        step: 1
      }
    },
    {
      tab: 'Format',
      caption: 'Format numbers with commas where appropriate (formatNumber)',
      type: 'checkbox',
      name: 'formatNumber',
      disabledIfChecked: 'hideValue'
    },
    {
      tab: 'Format',
      caption: 'Decimal places (decimals)',
      type: 'number',
      name: 'decimals',
      inputAttributes: {
        min: 0,
        max: 10,
        step: 1
      },
      disabledIfChecked: 'hideValue'
    },
    {
      tab: 'Gauge style',
      caption: 'Colors to use for each secor using CSS formats (e.g. as #ff0000 indicating Red), separated by commas. Each sector will be of equal size (levelColors)',
      type: 'text',
      name: 'levelColors'
    },
    {
      tab: 'Gauge style',
      caption: 'Use fixed sector colors rather than allowing colors to blend from one to another (noGradient)',
      type: 'checkbox',
      name: 'noGradient'
    },
    {
      tab: 'Gauge style',
      caption: 'Custom sections - specify the min, max and color for each segment e.g. "0,10,#ff0000;80,90,#00ff00" specifies red for 0-10 and green for 80-90 with all other values coloring using the sector colors (customSectors)',
      type: 'text',
      name: 'customSectors'
    },
    {
      tab: 'Gauge style',
      caption: 'Gauge background color (gaugeColor)',
      type: 'color',
      name: 'gaugeColor'
    },
    {
      tab: 'Gauge style',
      caption: 'Gauge width scaled, 1 indicates default, 2 twice the size etc. (gaugeWidthScale)',
      type: 'number',
      name: 'gaugeWidthScale',
      inputAttributes: {
        min: 0.1,
        max: 2,
        step: 0.1
      }
    },
    {
      tab: 'Gauge style',
      caption: 'Show inner shadow (showInnerShadow)',
      type: 'checkbox',
      name: 'showInnerShadow'
    },
    {
      tab: 'Gauge style',
      caption: 'Shadow opacity (shadowOpacity)',
      type: 'number',
      name: 'shadowOpacity',
      inputAttributes: {
        min: 0,
        max: 1,
        step: 0.1
      },
      enabledIfChecked: 'showInnerShadow'
    },
    {
      tab: 'Gauge style',
      caption: 'Shadow size (shadowSize)',
      type: 'number',
      name: 'shadowSize',
      inputAttributes: {
        min: 0,
        max: 50,
        step: 1
      },
      enabledIfChecked: 'showInnerShadow'
    },
    {
      tab: 'Gauge style',
      caption: 'Shadow vertical offset (shadowVerticalOffset)',
      type: 'number',
      name: 'shadowVerticalOffset',
      inputAttributes: {
        min: 0,
        max: 50,
        step: 1
      },
      enabledIfChecked: 'showInnerShadow'
    },
    {
      tab: 'Gauge style',
      caption: 'Donut starts at what angle (0=horizontal left) (donutStartAngle)',
      type: 'number',
      name: 'donutStartAngle',
      inputAttributes: {
        min: 0,
        max: 359,
        step: 5
      }
    },
    {
      tab: 'Animation',
      caption: 'Animation time in milliseconds (startAnimationTime)',
      type: 'number',
      name: 'startAnimationTime',
      inputAttributes: {
        min: 5,
        max: 10000,
        step: 100
      }
    },
    {
      tab: 'Animation',
      caption: 'Type of animation (startAnimationType)',
      type: 'select',
      name: 'startAnimationType',
      options: [
        { text: 'Linear', value: 'linear' },
        { text: '<', value: '<' },
        { text: '>', value: '>' },
        { text: '<>', value: '<>' },
        { text: 'Bounce', value: 'bounce' }
      ]
    }
  ]
})

var flexContainer

// Called the first time (and only the first time) we render
function firstTimeSetup (data, config) {
  var parent = $('#js_chart')

  // Create a container with appropriate style
  flexContainer = $('<div>').appendTo(parent)
    .css('display', 'flex')
    .css('flex-flow', 'row wrap')
    .css('justify-content', 'space-around')
    .css('height', '100%') // Explicit to avoid IE bug
}

// Main render method
function render (data, config) {
  // We can't adjust the gauges in any sort of logical way, so simply recreate everything whenever something changes
  flexContainer.empty()
  var gauges = []

  _.each(data.data, function (row, index) {
    var gaugeConfig = _.clone(config)
    JSVizHelper.pushBusy()

    // Pick up any configuration from the row of data, or assume we just have a value if only 1 column in the data
    if (data.columns.length === 1) {
      gaugeConfig.value = row.items[0]
    } else {
      _.each(data.columns, function (column, colIndex) {
        if ((row.items[colIndex] !== '') && (row.items[colIndex] !== null)) {
          gaugeConfig[column] = row.items[colIndex]
        }
      })
    }

    if (gaugeConfig.levelColors.length > 0) {
      gaugeConfig.levelColors = gaugeConfig.levelColors.split(',')
    } else {
      gaugeConfig.levelColors = []
    }
    if (gaugeConfig.customSectors.length > 0) {
      var ranges = _.map(gaugeConfig.customSectors.split(';'), function (piece) {
        var pieces = piece.split(',')
        return { lo: Number(pieces[0]), hi: Number(pieces[1]), color: pieces[2] }
      })
      gaugeConfig.customSectors = { percents: false, ranges: ranges }
    } else {
      gaugeConfig.customSectors = []
    }
    gaugeConfig.startAnimationType = gaugeConfig.startAnimationType.toLowerCase()
    gaugeConfig.onAnimationEnd = JSVizHelper.popBusy

    // We create a Div for each gauge, allowing flex box to flow things
    var newDiv = $('<div>').appendTo(flexContainer)
      .css('flex', '1 1 ' + gaugeConfig.minGaugeWidth + 'px') // grow, shrink, basis
      .css('min-width', gaugeConfig.minGaugeWidth + 'px')
      .css('min-height', gaugeConfig.minGaugeHeight + 'px')
      .css('max-width', gaugeConfig.maxGaugeWidth + 'px')
      .css('max-height', gaugeConfig.maxGaugeHeight + 'px')
      .attr('class', 'iqvia-mark-rect')
      .css('position', 'relative')
      .css('opacity', (row.hints.marked || data.baseTableHints.marked === 0) ? '1' : '0.1')

    $('<div>').appendTo(newDiv)
      .text(gaugeConfig.title)
      .css('position', 'absolute')
      .css('top', '20px')
      .css('width', '100%')
      .css('text-align', 'center')
      .css('font-size', gaugeConfig.titleFontSize + 'px')
      .css('font-weight', 'bold')
      .css('color', gaugeConfig.titleFontColor)

    // Create a gauge inside the new Div
    gaugeConfig.parentNode = newDiv[0]
    gauges[index] = new JustGage(gaugeConfig)

    // Set the data-id on the gauge itself to support marking
    $(gauges[index].gauge[0]).attr('data-id', row.hints.index)
  })
}
