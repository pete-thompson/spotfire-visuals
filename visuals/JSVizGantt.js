/* eslint-disable compat/compat */
// A Gantt chart

import { event as currentEvent } from 'd3-selection'

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')
var d3 = _.extend({}, require('d3-array'), require('d3-axis'), require('d3-format'), require('d3-scale'), require('d3-selection'), require('d3-shape'), require('d3-time-format'))
var moment = require('moment')

var $ = require('jquery')

// Include our stylesheet
require('../styles/JSVizGantt.css')

const zoomLevels = [
  { value: 'minute', text: 'Minute' },
  { value: 'hour', text: 'Hour' },
  { value: 'day', text: 'Day' },
  { value: 'week', text: 'Week' },
  { value: 'month', text: 'Month' },
  { value: 'quarter', text: 'Quarter' },
  { value: 'year', text: 'Year' }
]

// TODO - make configurable and add elements to allow user to change
const timelineMargin = 20
const levelIndent = 20
const titleWidth = 150

var defaultConfig = {
  eventIdColumn: 0,
  eventNameColumn: 1,
  eventStartColumn: 2,
  eventEndColumn: 3,
  eventStartMarkerColumn: 4,
  eventEndMarkerColumn: 5,
  eventValueColumn: 6,
  eventLineColumn: 7,
  sectionNameSeparator: '->',
  currentZoomLevel: 'day',
  maxZoomLevel: 'day',
  minZoomLevel: 'year',
  zoomLevelItemSize: 50,
  rowHeight: 60,
  rowPadding: 2
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  configuratorTitle: 'Gantt options',
  configOptions: [
    {
      tab: 'Data',
      caption: 'Event Id',
      name: 'eventIdColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'Event name',
      type: 'column-number',
      name: 'eventNameColumn',
      enabledIfChecked: 'useNodeColorColumn'
    },
    {
      tab: 'Data',
      caption: 'Event start',
      name: 'eventStartColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'Event End',
      name: 'eventEndColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'Start Marker CSS Classes',
      name: 'eventStartMarkerColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'End Marker CSS Classes',
      name: 'eventEndMarkerColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'Event Value',
      name: 'eventValueColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'Event Line CSS Classes',
      name: 'eventLineColumn',
      type: 'column-number'
    },
    {
      tab: 'Data',
      caption: 'Value to separate section name hierarchies',
      name: 'sectionNameSeparator',
      type: 'text'
    },
    {
      tab: 'Zoom',
      caption: 'Current zoom level',
      name: 'currentZoomLevel',
      type: 'select',
      options: zoomLevels
    },
    {
      tab: 'Zoom',
      caption: 'Minimum zoom level',
      name: 'minZoomLevel',
      type: 'select',
      options: zoomLevels
    },
    {
      tab: 'Zoom',
      caption: 'Maximum zoom level',
      name: 'maxZoomLevel',
      type: 'select',
      options: zoomLevels
    },
    {
      tab: 'Layout',
      caption: 'Width of each item at zoom level (e.g. size of a Day at Day level)',
      name: 'zoomLevelItemSize',
      type: 'number',
      inputAttributes: {
        min: 1,
        max: Infinity,
        step: 1
      }
    },
    {
      tab: 'Layout',
      caption: 'Row height',
      name: 'rowHeight',
      type: 'number',
      inputAttributes: {
        min: 1,
        max: Infinity,
        step: 1
      }
    },
    {
      tab: 'Layout',
      caption: 'Row padding',
      name: 'rowPadding',
      type: 'number',
      inputAttributes: {
        min: 1,
        max: Infinity,
        step: 1
      }
    }
  ]
})

// Called the first time (and only the first time) we render
function firstTimeSetup (data, config) {
  $('#js_chart').css('overflow-x', 'hidden')
}

//
// This is the main drawing method
//
function render (data, config) {
  // TODO - support a numeric x-axis as alternative to date
  // TODO - think about animation
  // TODO - zoom in/out buttons

  // Helper to get X axis values into appropriate form (date or integer (TODO))
  const xAxisValue = val => {
    if ((val === '') || (!val)) {
      return null
    } else if ((val.indexOf('/Date(') === 0) && (val.substr(val.length - 2) === ')/') && (val.length === 21)) {
      return new Date(Number(val.substr(6, 13)))
    } else {
      return new Date(val)
    }
  }

  // Find the earliest and latest dates (the extent)
  var extents = [config.eventStartColumn, config.eventEndColumn]
    .map(columnNumber => d3.extent(data.data, d => xAxisValue(d.items[columnNumber])))

  // use the zoom level as part of the extent
  var extent = [d3.min(extents, d => moment(d[0]).startOf(config.currentZoomLevel).valueOf()), d3.max(extents, d => moment(d[1]).endOf(config.currentZoomLevel).valueOf())]

  // Create an x axis scaled based on zoom level.
  var range = moment.duration(moment(extent[1]).diff(moment(extent[0])))
  var size = Math.round(range.as(config.currentZoomLevel))
  var timeScale = d3.scaleTime()
    .domain(extent)
    .range([0, size * config.zoomLevelItemSize])

  // Structure the data into sections
  const sectionRootSepRE = new RegExp('(.*?)(' + config.sectionNameSeparator + '.*|)$')
  const sectionNameSepRE = new RegExp('((.*)' + config.sectionNameSeparator + '|)(.*)$')
  const sectionNameFromName = (name) => sectionNameSepRE.exec(name)[2]
  const eventName = (name) => sectionNameSepRE.exec(name)[3]
  const sectionRoot = (name) => sectionRootSepRE.exec(name)[1]
  const nameInSection = (name, section) => sectionNameFromName(name) === section
  const nameWithinSection = (name, section) => name.startsWith(section + config.sectionNameSeparator)

  const buildEvent = event => {
    return {
      start: xAxisValue(event.items[config.eventStartColumn]),
      end: xAxisValue(event.items[config.eventEndColumn]),
      markerStart: event.items[config.eventStartMarkerColumn],
      markerEnd: event.items[config.eventEndMarkerColumn],
      line: event.items[config.eventLineColumn],
      isMarked: event.hints.marked,
      markIndex: event.hints.index
    }
  }

  const buildSection = function (sectionName) {
    const indentLevel = this.indentLevel
    return {
      name: sectionName,
      isSection: true,
      indentLevel: indentLevel,
      sections: _.uniq(data.data.map(row => sectionNameFromName(row.items[config.eventNameColumn])))
        .filter(newSectionName => nameInSection(newSectionName, sectionName))
        .map(buildSection, { indentLevel: this.indentLevel + 1 }),
      timeline: data.data
        .filter(event => nameWithinSection(event.items[config.eventNameColumn], sectionName))
        .map(buildEvent),
      // we want an array, but easiest way to group by event Id is using a hash table, hence we use Object.values to get the array
      events: Object.values(data.data
        .filter(event => nameInSection(event.items[config.eventNameColumn], sectionName))
        .reduce((r, a) => {
          const eventId = a.items[config.eventIdColumn]
          if (r[eventId]) {
            r[eventId].timeline = [...r[eventId].timeline, buildEvent(a)]
          } else {
            r[eventId] = {
              id: eventId,
              isSection: false,
              name: a.items[config.eventNameColumn],
              indentLevel: indentLevel,
              timeline: [buildEvent(a)]
            }
          }
          return r
        }, []))
    }
  }

  const sectionsData = _.uniq(data.data.map(row => sectionRoot(row.items[config.eventNameColumn])))
    .map(buildSection, { indentLevel: 0 })

  // Helper for creating a row (event or section)
  const createRow = (selection, rowClass) => {
    var row = selection.append('div').classed(rowClass, true)
    row.append('div').classed('expandCollapse', true)
    row.append('div').classed('title', true)
    row.append('div').classed('timeline', true)
      .append('svg').attr('width', '100%').attr('height', config.rowHeight + config.rowPadding)
    return row
  }

  // Helper for assigning CSS classes to a selection
  const assignCSSClasses = (selection, attribute) => {
    selection.each((d, i, n) => {
      if (d[attribute]) {
        const classes = d[attribute].split('+')
        classes.forEach(element => {
          d3.select(n[i]).classed(element, true)
        })
        d3.select(n[i]).classed('None', classes.count === 0)
      } else {
        d3.select(n[i]).classed('None', true)
      }
    })
  }

  // Create each section in a selection (recursively calls for hierarchical sections)
  const createSections = (selection) => {
    selection = selection.join(enter => {
      var section = enter.append('div').classed('section', true)
      createRow(section, 'sectionHeader')
      section.append('div').classed('sectionContent', true)
      return section
    })

    // Recursive call for sub-sections
    const subSections = selection
      .selectAll('.sectionContent')
      .selectAll(':scope > .section')
      .data(d => d.sections)
    if (!subSections.enter().empty()) createSections(subSections)
  }

  // Create the top level sections (which recursively adds subsections)
  var sections = d3.select('#js_chart')
    .selectAll('.section')
    .data(sectionsData)

  createSections(sections)

  // Setup expand/collapse
  d3.selectAll('.sectionHeader .expandCollapse')
    .append('span')
    .classed('caret', true)
    .classed('caretDown', true)
  d3.selectAll('.sectionHeader')
    .on('click', function (selected) {
      // Use a regular function so that 'this' works
      currentEvent.stopPropagation()
      const caret = d3.select(this).select('.caret')
      const sectionContent = d3.select(this.closest('.section')).select(':scope > .sectionContent')
      const wasExpanded = caret.classed('caretDown')
      caret.classed('caretDown', !wasExpanded)
      caret.classed('caretRight', wasExpanded)
      sectionContent.classed('expanded', !wasExpanded)
      sectionContent.classed('collapsed', wasExpanded)
    })

  // Populate events
  d3.selectAll('.sectionContent')
    .selectAll(':scope > .event')
    .data(d => d.events)
    .join(enter => createRow(enter, 'event'))

  // Drawing relies on the fact that data has common properties - i.e. both events and sections have names, timelines etc.
  // Populate the titles (sections and events)
  d3.selectAll('.title')
    .style('padding-left', d => Math.min(d.indentLevel * levelIndent, titleWidth) + 'px')
    .style('width', d => Math.max(titleWidth - d.indentLevel * levelIndent, 0) + 'px')
    .text(d => eventName(d.name))

  // Draw timelines (sections and events)
  const timelines = d3.selectAll('.timeline svg')
    .selectAll(':scope > .timelineItem')
    .data(d => d.timeline)
    .join(enter => {
      const group = enter.append('g').classed('timelineItem', true)
      // Line first so that it appears behind markers
      group.append('line').classed('itemLine', true)
      group.append('path').classed('markerStart', true)
      group.append('path').classed('markerEnd', true)
      return group
    })
    .attr('transform', 'translate(' + timelineMargin + ',' + config.rowHeight / 2 + ')')

  timelines.selectAll('.markerStart')
    .attr('transform', d => {
      return 'translate(' + timeScale(d.start) + ') scale(' + config.rowHeight / 2 + ')'
    })
    .call(assignCSSClasses, 'markerStart')

  timelines.selectAll('.markerEnd').filter(d => !d.end).remove()
  timelines.selectAll('.markerEnd')
    .attr('transform', d => {
      return 'translate(' + timeScale(d.end) + ') scale(' + config.rowHeight / 2 + ')'
    })
    .call(assignCSSClasses, 'markerEnd')

  timelines.selectAll('.itemLine').filter(d => !d.end).remove()
  timelines.selectAll('.itemLine')
    .call(assignCSSClasses, 'line')
    .attr('x1', d => timeScale(d.start))
    .attr('y1', 0)
    .attr('x2', d => timeScale(d.end))
    .attr('y2', 0)
}
