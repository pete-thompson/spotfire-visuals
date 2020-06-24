// The original code for this partly came from http://bl.ocks.org/nbremer/6506614, obtained under the MIT (https://opensource.org/licenses/MIT) license
// Significant adjustments have been made to support embedding the script within Spotfire, to fix lots of sizing issues, to support different scales on each axis and to simplify the passing of data from Spotfire.

// TODO - simplify so that we can use the Spotfire version of the data directly without copying

var JSVizHelper = require('../lib/JSVizHelper.js')
var d3 = require('d3')
d3.scale = require('d3-scale')
var _ = require('underscore')
var dataIndexMapColumn = '_dataIndexMap'

var defaultConfig = {
  legendColumn: '',
  valuesInColumns: true,
  axisColumn: '',
  valueColumn: '',
  pointRadius: 5,
  axisTicks: 5,
  singleAxisScale: false,
  useZeroOrigin: false,
  minValue: 0,
  maxValue: 0,
  axisLabelFormat: '.3r',
  legendPosition: 100,
  opacityArea: 0.25,
  spaceForAxisTitleX: 60,
  spaceForAxisTitleY: 30,
  useCircularAxes: false
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  renderOnResize: true,
  mark: {
    selector: '#radar-chart svg',
    type: JSVizHelper.markType.svg
  },
  configuratorTitle: 'Radar chart options',
  configuratorInstructions: "In a Radar chart an 'axis' relates to a column in the data and is represented by a radial line drawn from the centre outwards. Thus, sharing an axis scale means that the values in each column should fit the same scale (min-max), specifying the axis min/max affects the range of values between the centre (min) and outer extreme (max) and so on.",
  configOptions: [
    {
      caption: 'Values in columns',
      type: 'checkbox',
      name: 'valuesInColumns',
      tab: 'Data'
    },
    {
      caption: 'Legend column name',
      type: 'column',
      name: 'legendColumn',
      tab: 'Data'
    },
    {
      caption: 'Axis column name',
      type: 'column',
      name: 'axisColumn',
      disabledIfChecked: 'valuesInColumns',
      tab: 'Data'
    },
    {
      caption: 'Value column name',
      type: 'column',
      name: 'valueColumn',
      disabledIfChecked: 'valuesInColumns',
      tab: 'Data'
    },
    {
      caption: 'Point radius in pixels',
      type: 'number',
      name: 'pointRadius',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    },
    {
      caption: 'Number of ticks on axes',
      type: 'number',
      name: 'axisTicks',
      tab: 'Axes',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    },
    {
      caption: 'Use circular axes',
      type: 'checkbox',
      name: 'useCircularAxes',
      tab: 'Appearance'
    },
    {
      caption: 'Use a single scale for all axes',
      type: 'checkbox',
      name: 'singleAxisScale',
      valueIfChecked: 'true',
      tab: 'Axes'
    },
    {
      caption: 'Use zero origin for all axes',
      type: 'checkbox',
      name: 'useZeroOrigin',
      valueIfChecked: 'true',
      tab: 'Axes'
    },
    {
      caption: 'Axis minimum value (a value of 0 means that the value is calculated based on the data)',
      type: 'number',
      name: 'minValue',
      tab: 'Axes'
    },
    {
      caption: 'Axis maximum value (a value of 0 means that the value is calculated based on the data)',
      type: 'number',
      name: 'maxValue',
      tab: 'Axes'
    },
    {
      caption: "Aixs label format - labels are only shown when axes share a single scale. Formats are specified using D3's library (<a href='https://github.com/d3/d3-format'>here</a>)",
      type: 'text',
      name: 'axisLabelFormat',
      tab: 'Axes'
    },
    {
      caption: 'Size of legend in pixels',
      type: 'number',
      name: 'legendPosition',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 1000,
        step: 1
      }
    },
    {
      caption: 'Opacity level of the filled areas (0=clear, 1=solid)',
      type: 'number',
      name: 'opacityArea',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 1,
        step: 0.05
      }
    },
    {
      caption: 'Space to leave for labels to the sides in pixels',
      type: 'number',
      name: 'spaceForAxisTitleX',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 1000,
        step: 1
      }
    },
    {
      caption: 'Space to leave for labels above and below in pixels',
      type: 'number',
      name: 'spaceForAxisTitleY',
      tab: 'Appearance',
      inputAttributes: {
        min: 0,
        max: 1000,
        step: 1
      }
    }
  ]
})

function asDataInColumns (data, cfg) {
  var groups = _.groupBy(data, cfg.legendColumn)
  return _.map(groups, function (group, groupKey) {
    var newRow = {}
    newRow[cfg.legendColumn] = groupKey
    newRow[dataIndexMapColumn] = {}
    _.each(group, function (originalRow) {
      var axisKey = originalRow[cfg.axisColumn]
      var val = originalRow[cfg.valueColumn]
      newRow[axisKey] = val
      newRow[dataIndexMapColumn][axisKey] = originalRow[JSVizHelper.DataIndexColumn]
    })
    return newRow
  })
}

function firstTimeSetup (data, config) {
  defaultConfig.legendColumn = data.columns[0]
}
//
// This is the main drawing method
//
function render (data, config) {
  //
  // Now render it
  //
  var chartObject = d3.select('#radar-chart')
  if (chartObject.empty()) {
    chartObject = d3.select('#js_chart').append('DIV').attr('id', 'radar-chart').style('width', '100%').style('height', '100%').style('display', 'block').style('overflow', 'hidden')
  }

  function radialX (axisNumber, portionOfRadius) {
    // portionOfCircle of 0 is straight up, 0.5 is straight down, 1 back up again
    return (portionOfRadius * radius + cfg.centerSpace) * Math.sin(axisNumber * Math.PI * 2 / cfg.axisColumns.length) + centerX
  };
  function radialY (axisNumber, portionOfRadius) {
    // portionOfCircle of 0 is straight up, 0.5 is straight down, 1 back up again
    return -1 * (portionOfRadius * radius + cfg.centerSpace) * Math.cos(axisNumber * Math.PI * 2 / cfg.axisColumns.length) + centerY
  };

  // Simplify how we deal with the data
  var d = JSVizHelper.DataAsNamedArray(data, true)

  let additionalData = []
  if (data.additionalTables) {
    additionalData = data.additionalTables.map(function (table) { return JSVizHelper.DataAsNamedArray(table, false) })
  }

  var showLegend = data.legend

  var cfg = {
    w: chartObject.node().getBoundingClientRect().width,
    h: chartObject.node().getBoundingClientRect().height,
    centerSpace: 20,
    color: d3.scaleOrdinal(d3.schemeCategory10),
    axisLabelToRight: 5,
    axisColumns: []
  }

  // Copy any configuration options passed in to the cfg variable
  _.extend(cfg, config)

  if (showLegend === false) {
    cfg.legendPosition = 0
  }

  // Default the legend column to the first column in the data
  if (cfg.legendColumn.length === 0) {
    cfg.legendColumn = d3.keys(d[0])[0]
  }

  // Reshape the data if it's provided in rows rather than Columns
  if (!cfg.valuesInColumns) {
    if (cfg.axisColumn.length === 0) cfg.axisColumn = d3.keys(d[0])[1]
    if (cfg.valueColumn.length === 0) cfg.valueColumn = d3.keys(d[0])[2]
    d = asDataInColumns(d, cfg)
    additionalData = additionalData.map(function (table) { return asDataInColumns(table, cfg) })
  } else {
    // Build the data index array column to repeat the data ID for the row for each column
    // This array holds the index of each of the individual data elements associated with each chart point, but for row data they're all the same
    _.each(d, function (dataRow, index) {
      dataRow[dataIndexMapColumn] = {}
      _.each(dataRow, function (value, key) {
        dataRow[dataIndexMapColumn][key] = dataRow[JSVizHelper.DataIndexColumn]
      })
    })
  }

  // Find the axis columns if not specified (use everything except the legend and the marked indicator+index)
  if (cfg.axisColumns.length === 0) {
    d3.keys(d[0]).forEach(function (i, j) {
      if ((i !== cfg.legendColumn) && (i !== JSVizHelper.DataIndexColumn) && (i !== JSVizHelper.DataMarkedColumn) && (i !== dataIndexMapColumn)) {
        cfg.axisColumns.push(i)
      }
    })
  }

  // Find the overall max/min - we may adjust later if we're using different scales on each axis
  if (cfg.useZeroOrigin) {
    cfg.minValue = 0
  } else {
    cfg.minValue = d3.min([cfg.minValue, d3.min(d, function (row) {
      return d3.min(cfg.axisColumns.map(function (axis) {
        return +row[axis]
      }))
    }), d3.min(additionalData, function (table) {
      // Search additional tables
      return d3.min(table, function (row) {
        return d3.min(cfg.axisColumns.map(function (axis) {
          return +row[axis]
        }))
      })
    })])
  }
  // always make sure the max is at least one more than the min
  cfg.maxValue = d3.max([cfg.maxValue, Math.max(cfg.minValue + 1, d3.max(d, function (row) {
    return d3.max(cfg.axisColumns.map(function (axis) {
      return +row[axis]
    }))
  })), d3.max(additionalData, function (table) {
    // Search additional tables
    return d3.max(table, function (row) {
      return d3.max(cfg.axisColumns.map(function (axis) {
        return +row[axis]
      }))
    })
  })])

  // Calculate the position of the chart
  var radius = Math.min((cfg.w - cfg.legendPosition) / 2 - cfg.spaceForAxisTitleX - cfg.centerSpace, cfg.h / 2 - cfg.spaceForAxisTitleY - cfg.centerSpace)
  var centerX = (cfg.w - cfg.legendPosition) / 2
  var centerY = cfg.h / 2

  var Format = d3.format(cfg.axisLabelFormat)

  // Determine the min and max values to use for each axis
  var minForAxis = (cfg.axisColumns.map(function (axisName) {
    if (!cfg.singleAxisScale && !cfg.useZeroOrigin) {
      return d3.min([d3.min(d.map(function (dataRow) {
        return +dataRow[axisName]
      })), d3.min(additionalData, function (table) {
        // Search additional tables
        return d3.min(table, function (row) {
          return +row[axisName]
        })
      })])
    } else {
      return cfg.minValue
    }
  }))
  var maxForAxis = (cfg.axisColumns.map(function (axisName, axisNumber) {
    if (!cfg.singleAxisScale) {
      // always make sure the max is at least one more than the min
      return d3.max([minForAxis[axisNumber] + 1, d3.max(d.map(function (dataRow) {
        return +dataRow[axisName]
      })), d3.max(additionalData, function (table) {
        // Search additional tables
        return d3.max(table, function (row) {
          return +row[axisName]
        })
      })])
    } else {
      return cfg.maxValue
    }
  }))

  // Clear any existing chart
  chartObject.select('svg').remove()

  // Create the chart
  var svg = chartObject.append('svg').attr('width', cfg.w).attr('height', cfg.h)
  // Update the default fill color (particularly for text) in case theme changes
  svg.attr('fill', d3.select('body').style('color'))

  // Circular segments
  var g = svg.append('g').attr('class', 'radarCircles')
  for (var j = 0; j < cfg.axisTicks; j++) {
    var levelFactor = (j / (cfg.axisTicks - 1))

    if (cfg.useCircularAxes) {
      g.selectAll('.axisTicks').data(cfg.axisColumns).enter().append('svg:circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', radius * levelFactor + cfg.centerSpace)
        .attr('fill', 'none')
        .attr('class', 'line').style('stroke', 'grey').style('stroke-opacity', '0.75').style('stroke-width', '0.3px')
    } else {
      g.selectAll('.axisTicks').data(cfg.axisColumns).enter().append('svg:line').attr('x1', function (d, i) {
        return radialX(i, levelFactor)
      }).attr('y1', function (d, i) {
        return radialY(i, levelFactor)
      }).attr('x2', function (d, i) {
        return radialX((i + 1), levelFactor)
      }).attr('y2', function (d, i) {
        return radialY((i + 1), levelFactor)
      }).attr('class', 'line').style('stroke', 'grey').style('stroke-opacity', '0.75').style('stroke-width', '0.3px')
    }
  }

  if (cfg.singleAxisScale) {
    // Draw axis labels
    g = svg.append('g').attr('class', 'axisLabels')
    for (j = 0; j < cfg.axisTicks; j++) {
      levelFactor = (j / (cfg.axisTicks - 1))
      g.selectAll('.axisTicks').data([1])// dummy data
        .enter().append('svg:text').attr('x', function (d) {
          return radialX(0, levelFactor)
        }).attr('y', function (d) {
          return radialY(0, levelFactor)
        }).attr('class', 'legend').attr('transform', 'translate(' + (cfg.axisLabelToRight) + ', 0)').attr('fill', '#737373').text(Format(cfg.minValue + j * (cfg.maxValue - cfg.minValue) / (cfg.axisTicks - 1)))
    }
  }

  var series = 0

  // Draw the axes - lines outwards and labels
  g = svg.append('g').attr('class', 'axes')
  var axis = g.selectAll('.axis').data(cfg.axisColumns).enter().append('g').attr('class', 'axis')

  axis.append('line').attr('x1', function (d, i) {
    return radialX(i, 0)
  }).attr('y1', function (d, i) {
    return radialY(i, 0)
  }).attr('x2', function (d, i) {
    return radialX(i, 1)
  }).attr('y2', function (d, i) {
    return radialY(i, 1)
  }).attr('class', 'line').style('stroke', 'grey').style('stroke-width', '1px')

  var oldRadius = radius
  radius = radius + cfg.spaceForAxisTitleY / 2
  axis.append('text').attr('class', 'legend').text(function (d) {
    return d
  }).attr('text-anchor', 'middle').attr('dy', '0.5em').attr('x', function (d, i) {
    return radialX(i, 1)
  }).attr('y', function (d, i) {
    return radialY(i, 1)
  })
  radius = oldRadius

  // Draw the chart polygons
  var seriesGroup = svg.append('g').attr('class', 'series')
  d.forEach(function (dataRow) {
    var dataValues = []
    seriesGroup.selectAll('.nodes').data(cfg.axisColumns, function (axis, i) {
      dataValues.push([radialX(i, (dataRow[axis] - minForAxis[i]) / (maxForAxis[i] - minForAxis[i])), radialY(i, (dataRow[axis] - minForAxis[i]) / (maxForAxis[i] - minForAxis[i]))])
    })
    dataValues.push(dataValues[0])
    seriesGroup
      .selectAll('.area')
      .data([dataValues])
      .enter()
      .append('polygon')
      .attr('class', 'radar-chart-series' + series)
      .style('stroke-width', '2px')
      .style('stroke', cfg.color(series))
      .attr('data-id-array-private', JSON.stringify(_.toArray(dataRow[dataIndexMapColumn])))
      .attr('points', function (d) {
        var str = ''
        for (var pti = 0; pti < d.length; pti++) {
          str = str + d[pti][0] + ',' + d[pti][1] + ' '
        }
        return str
      }).style('fill', function (j, i) { return cfg.color(series) })
      .style('fill-opacity', cfg.opacityArea)
      .on('mouseover', function (d) {
        var z = 'polygon.' + d3.select(this).attr('class')
        seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', 0.1)
        seriesGroup.selectAll(z).transition(200).style('fill-opacity', 0.7)
      }).on('mouseout', function () {
        seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', cfg.opacityArea)
      })
      .on('click', function () {
        // We're not using the data-id attribute because we don't want to mark these based on drag-selects
        var markData = { markMode: 'Replace', indexSet: _.uniq(JSON.parse(d3.select(this).attr('data-id-array-private'))) }
        window.markIndices(markData)
        d3.event.stopPropagation()
      }).append('svg:title').text(dataRow[cfg.legendColumn])
    series++
  })

  // Draw the points on the chart
  g = svg.append('g').attr('class', 'seriesPoints')
  series = 0
  d.forEach(function (dataRow, rowNumber) {
    g.selectAll('.nodes').data(cfg.axisColumns).enter().append('svg:circle').attr('class', 'radar-chart-point').attr('r', cfg.pointRadius).attr('alt', function (axis) {
      return dataRow[axis]
    }).attr('cx', function (axis, i) {
      return radialX(i, (dataRow[axis] - minForAxis[i]) / (maxForAxis[i] - minForAxis[i]))
    }).attr('cy', function (axis, i) {
      return radialY(i, (dataRow[axis] - minForAxis[i]) / (maxForAxis[i] - minForAxis[i]))
    }).attr('data-id', function (axis) {
      // Store the ID so we can use for marking later
      return dataRow[dataIndexMapColumn][axis]
    }).style('fill', cfg.color(series)).style('fill-opacity', 0.9).on('mouseover', function (axis) {
      var z = 'polygon.' + d3.select(this).attr('class')
      seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', 0.1)
      seriesGroup.selectAll(z).transition(200).style('fill-opacity', 0.7)
    }).on('mouseout', function () {
      seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', cfg.opacityArea)
    }).append('svg:title').text(function (axis) {
      return Format(dataRow[axis])
    })

    series++
  })

  if (showLegend) {
    var fontSize = chartObject.style('font-size')
    var legendSpacing = parseInt(fontSize) * 1.5
    // Initiate Legend
    var legend = svg.append('g').attr('class', 'legend')
    // Create colour circles
    legend
      .selectAll('circle')
      .data(d)
      .enter()
      .append('circle')
      .attr('class', 'mark-data')
      .attr('class', function (dataRow, i) { return 'radar-chart-series' + i })
      .attr('cx', cfg.w - cfg.legendPosition - 15)
      .attr('cy', function (dataRow, i) { return (i + 0.5) * legendSpacing })
      .attr('r', cfg.pointRadius)
      .attr('data-id-array', function (dataRow, rowNumber) { return JSON.stringify(_.toArray(dataRow[dataIndexMapColumn])) })
      .style('fill', function (dataRow, i) { return cfg.color(i) })
      .on('mouseover', function () {
        var z = 'polygon.' + d3.select(this).attr('class')
        seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', 0.1)
        seriesGroup.selectAll(z).transition(200).style('fill-opacity', 0.7)
      }).on('mouseout', function () {
        seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', cfg.opacityArea)
      })
    // Create text next to circles
    legend
      .selectAll('text')
      .data(d)
      .enter()
      .append('text')
      .attr('x', cfg.w - cfg.legendPosition)
      .attr('y', function (dataRow, i) { return (i + 0.5) * legendSpacing })
      .attr('dominant-baseline', 'central')
      .attr('class', function (dataRow, i) { return 'radar-chart-series' + i })
      .text(function (dataRow) { return dataRow[cfg.legendColumn] })
      .attr('data-id-array', function (dataRow, rowNumber) { return JSON.stringify(_.toArray(dataRow[dataIndexMapColumn])) })
      .on('mouseover', function () {
        var z = 'polygon.' + d3.select(this).attr('class')
        seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', 0.1)
        seriesGroup.selectAll(z).transition(200).style('fill-opacity', 0.7)
        d3.select(this).attr('text-decoration', 'underline')
      }).on('mouseout', function () {
        seriesGroup.selectAll('polygon').transition(200).style('fill-opacity', cfg.opacityArea)
        d3.select(this).attr('text-decoration', '')
      })
  }
};
