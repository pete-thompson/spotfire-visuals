// Very simple visualisation to display a bulletted list

var $ = require('jquery')
var JSVizHelper = require('../lib/JSVizHelper.js')
var _ = require('underscore')

var defaultConfig = {
  titleColumn: '',
  textColumn: '',
  levelColumn: '',
  orderColumn: '',
  useTitleColumn: false,
  useLevelColumn: false,
  useOrderColumn: false,
  titleSeparator: '-',
  fontSizes: '1.5em,1.2em,1em',
  titleStyle: 'font-weight: bold',
  markedStyle: 'font-style: italic'
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  render: render,
  mark: {
    selector: '#js_chart li span',
    type: JSVizHelper.markType.rect
  },
  configuratorTitle: 'Bulleted List options',
  configOptions: [
    {
      caption: 'Text column',
      type: 'column',
      name: 'textColumn',
      tab: 'Data'
    },
    {
      caption: 'Use title column?',
      type: 'checkbox',
      name: 'useTitleColumn',
      tab: 'Data'
    },
    {
      caption: 'Title column',
      type: 'column',
      name: 'titleColumn',
      enabledIfChecked: 'useTitleColumn',
      tab: 'Data'
    },
    {
      caption: 'Use level column?',
      type: 'checkbox',
      name: 'useLevelColumn',
      tab: 'Data'
    },
    {
      caption: 'Level column',
      type: 'column',
      name: 'levelColumn',
      enabledIfChecked: 'useLevelColumn',
      tab: 'Data'
    },
    {
      caption: 'Use order column?',
      type: 'checkbox',
      name: 'useOrderColumn',
      tab: 'Data'
    },
    {
      caption: 'Order column',
      type: 'column',
      name: 'orderColumn',
      enabledIfChecked: 'useOrderColumn',
      tab: 'Data'
    },
    {
      caption: 'Separator between title and text',
      type: 'text',
      name: 'titleSeparator',
      tab: 'Appearance',
      inputAttributes: {
        size: 5
      }
    },
    {
      caption: 'Font sizes - provide a comma-separated list of sizes from largest to smallest, using any valid css font size (e.g. 1em, 10px, 50%)',
      type: 'text',
      name: 'fontSizes',
      tab: 'Appearance',
      inputAttributes: {
        size: 30
      }
    },
    {
      caption: "CSS Style applied to each title (e.g. 'font-weight: bold')",
      type: 'text',
      name: 'titleStyle',
      tab: 'Appearance',
      inputAttributes: {
        size: 30
      }
    },
    {
      caption: "CSS Style applied to items that are marked (e.g. 'font-style: italic')",
      type: 'text',
      name: 'markedStyle',
      tab: 'Appearance',
      inputAttributes: {
        size: 30
      }
    }

  ]
})

//
// This is the main drawing method
//
function render (data, config) {
  // Clear out any existing HTML
  $('#js_chart ul').remove()
  var ul = []
  var currentLevel = 1
  ul.push($('<ul>').appendTo('#js_chart'))
  var fontSizes = config.fontSizes.split(',')

  // Collect data into a more manageable format
  var chartData = JSVizHelper.DataAsNamedArray(data, true)

  if (config.useOrderColumn && (config.orderColumn.length > 0)) {
    chartData = _.sortBy(chartData, config.orderColumn)
  }

  // Add a bullet item for each row
  chartData.forEach(function (dataRow) {
    if (config.useLevelColumn && (config.levelColumn.length > 0)) {
      while (currentLevel < Number(dataRow[config.levelColumn])) {
        ul.push($('<ul>').appendTo(ul[currentLevel - 1].children('li').last()))
        currentLevel++
      }
      while (currentLevel > Number(dataRow[config.levelColumn])) {
        ul.pop()
        currentLevel--
      }
    }
    var span = $('<span>').appendTo($('<li>').appendTo(ul[currentLevel - 1]))
    if (config.useTitleColumn && (config.titleColumn.length > 0)) {
      $('<span>').text(dataRow[config.titleColumn]).attr('style', config.titleStyle).appendTo(span)
      if (dataRow[config.textColumn] && dataRow[config.textColumn].length > 0) {
        $('<span>').text(' ' + config.titleSeparator + ' ').appendTo(span)
      }
    }
    $('<span>').text(dataRow[config.textColumn]).appendTo(span)
    if (dataRow[JSVizHelper.DataMarkedColumn]) {
      span.attr('style', config.markedStyle)
    }
    span.css('font-size', fontSizes[ Math.min(currentLevel, fontSizes.length) - 1 ])
    span.attr('data-id', dataRow[JSVizHelper.DataIndexColumn])
  })
}
