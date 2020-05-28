// A visualisation that allows for animation of data on a page
// Provides a way to step through rows, marking them one at a time

var _ = require('underscore')
var JSVizHelper = require('../lib/JSVizHelper.js')

var $ = require('jquery')

require('jquery-ui/ui/widgets/button.js')
require('jquery-ui/ui/widgets/autocomplete.js')
require('jquery-ui/ui/widgets/datepicker.js')
require('jquery-ui/ui/widgets/slider.js')
require('jquery-ui/themes/base/all.css')

var defaultConfig = {
  playOnInitialisation: false,
  controlStyle: 'VCR',
  showPlayPause: true,
  showSpeedControls: true,
  playSpeed: 2,
  htmlAbove: '',
  htmlBelow: '',
  showJump: true,
  dateFormat: 'MM yy'
}

JSVizHelper.SetupViz({
  defaultConfig: defaultConfig,
  firstTimeSetup: firstTimeSetup,
  render: render,
  mark: function (markMode, rectangle) {}, // Ignore any marking (we'll disable the drag selection later)
  configuratorTitle: 'Data Animator options',
  configuratorInstructions: 'The Data Animator will mark rows from the underlying dataset based on user interaction.',
  configOptions: [
    {
      caption: 'Start playing animation on initialisation',
      type: 'checkbox',
      name: 'playOnInitialisation',
      valueIfChecked: true,
      valueIfUnchecked: false
    },
    {
      caption: 'Type of controls to use',
      type: 'select',
      name: 'controlStyle',
      options: [
        { text: 'VCR buttons', value: 'VCR' },
        { text: 'Slider', value: 'slider' }
      ]
    },
    {
      caption: 'Show Play/Pause control',
      type: 'checkbox',
      name: 'showPlayPause',
      valueIfChecked: true,
      valueIfUnchecked: false
    },
    {
      caption: 'Show speed controls',
      type: 'checkbox',
      name: 'showSpeedControls',
      valueIfChecked: true,
      valueIfUnchecked: false
    },
    {
      caption: 'Time between marking steps when playing (in seconds)',
      type: 'number',
      name: 'playSpeed',
      inputAttributes: {
        min: 0,
        max: 100,
        step: 1
      }
    },
    {
      caption: 'Text to show above the buttons (HTML is allowed)',
      type: 'text',
      name: 'htmlAbove'
    },
    {
      caption: 'Text to show below the buttons (HTML is allowed)',
      type: 'text',
      name: 'htmlBelow'
    },
    {
      caption: 'Show jump to control',
      type: 'checkbox',
      name: 'showJump',
      valueIfChecked: true,
      valueIfUnchecked: false
    },
    {
      caption: 'If values are dates show them as',
      type: 'select',
      name: 'dateFormat',
      options: [
        { value: 'd-M-yy', text: 'Day' },
        { value: 'MM yy', text: 'Month' },
        { value: 'yy', text: 'Year' }
      ]
    }
  ]
})

var markingHandler
var speedHandler
var divAbove
var divBelow

function MarkingHandler (buttonPanel) {
  // Private members
  var indices = []
  var position = -1
  var positionsWeveMarked = []
  var playing = false
  var playSpeed = 0
  var respondedToInitialStart = false
  var playIntervalId
  var lastConfiguredSpeed
  var jumpValues

  // Public methods
  this.setupFromData = function (data, config) {
    // Capture any config we need to respond to
    if (config.playSpeed !== lastConfiguredSpeed) {
      lastConfiguredSpeed = config.playSpeed
      this.setPlaySpeed(config.playSpeed)
    }

    // We know what the max is now, so set it
    slider.slider('option', { max: indices.length - 1 })

    if (config.controlStyle === 'VCR') {
      slider.hide()
      moveForwardButton.show()
      moveBackwardButton.show()
      jumpStartButton.show()
      jumpEndButton.show()

      if (config.showPlayPause) {
        playPauseButton.show()
      } else {
        playPauseButton.hide()
      }
    } else {
      slider.show()
      playPauseButton.hide()
      moveForwardButton.hide()
      moveBackwardButton.hide()
      jumpStartButton.hide()
      jumpEndButton.hide()
      jumpLabel.hide()
      jumpInput.hide()

      if (config.showPlayPause) {
        sliderPlayPauseButton.show()
      } else {
        sliderPlayPauseButton.hide()
      }
    }

    if (config.showJump) {
      jumpLabel.show()
      jumpInput.show()
      // Create a simple array for the jump control
      jumpValues = _.reduce(data.data, function (result, d) {
        var value = d.items[0].toString().trim()
        if ((value.indexOf('/Date(') === 0) && (value.substr(value.length - 2) === ')/') && (value.length === 21)) {
          value = new Date(Number(value.substr(6, 13)))
          value = $.datepicker.formatDate(config.dateFormat, value)
        }
        result.push(value)
        return result
      }, [])
      jumpInput.autocomplete('option', 'source', jumpValues)
    } else {
      jumpValues = []
      jumpLabel.hide()
      jumpInput.hide()
    }

    if (config.playOnInitialisation) {
      if (!respondedToInitialStart) {
        if (config.controlStyle === 'VCR') {
          playPauseButton.click()
        } else {
          sliderPlayPauseButton.click()
        }
        respondedToInitialStart = true
      }
    }

    // Create a simple array for the marking indices
    indices = _.reduce(data.data, function (result, d) { result.push(d.hints.index); return result }, [])

    // Find the current marked position (just pick the first marked row)
    // This supports marking the position using some other visualisation on the page - we can then respond to the new position
    var firstMarked = _.reduce(data.data, function (result, d) { return (result !== -1) ? result : (d.hints.marked ? d.hints.index : -1) }, -1)
    if (firstMarked !== -1) {
      // Check if this is a response to a marking that we sent - events take a little time to get returned from the server and we
      // want to avoid race conditions where we send multiple marking requests before the server responds to the first one
      if (_.indexOf(positionsWeveMarked, firstMarked) === -1) {
        // We'll ignore markings when we're playing - sometimes the server seems to send responses multiple times meaning that play jumps back and forth, so easier to just not support changes while we're playing
        if (playing) {
          console.log('Ignoring marking request for position ' + firstMarked + ' because we\'re playing')
        } else {
          setPosition(firstMarked)
        }
      } else {
        // remove from the list of positions we've requested
        console.log('Ignoring marking request for position ' + firstMarked + ' because we requested it.')
        positionsWeveMarked.splice(_.indexOf(positionsWeveMarked, firstMarked), 1)
      }
    } else {
      // Initial load - jump to start
      setPosition(0)
    }
  }

  this.setPlaySpeed = function (newSpeed) {
    // Allow for external changes to the play speed - restart the interval if changed
    if (playSpeed !== newSpeed) {
      playSpeed = newSpeed
      if (playing) {
        clearInterval(playIntervalId)
        playIntervalId = setInterval(playTickHandler, playSpeed * 1000)
      }
    }
  }

  // Private implementation code
  function setPosition (newPosition) {
    // Drop out if there is no data - avoids errors setting marking when there's no data
    if (indices.length === 0) {
      moveBackwardButton.button('option', 'disabled', true)
      jumpStartButton.button('option', 'disabled', true)
      moveForwardButton.button('option', 'disabled', true)
      jumpEndButton.button('option', 'disabled', true)
      playPauseButton.button('option', 'disabled', true)
      slider.slider('option', 'disabled', true)
    } else {
      newPosition = Math.max(Math.min(newPosition, indices.length - 1), 0)
      if (newPosition !== position) {
        // Set the position - enable/disable appropriate buttons and send the marking event
        position = newPosition
        moveBackwardButton.button('option', 'disabled', position === 0)
        jumpStartButton.button('option', 'disabled', position === 0)
        moveForwardButton.button('option', 'disabled', position === indices.length - 1)
        jumpEndButton.button('option', 'disabled', position === indices.length - 1)
        playPauseButton.button('option', 'disabled', position === indices.length - 1)
        slider.slider('value', newPosition)

        // Show the user where we are
        if (jumpValues.length > position) jumpInput.val(jumpValues[position])

        // Send marking request to Spotfire
        positionsWeveMarked.push(indices[position])
        window.markIndices({ markMode: 'Replace', indexSet: [ indices[position] ] })
      }
    }
  }

  var jumpStartButton = $('<button>')
    .appendTo(buttonPanel)
    .button({
      icon: 'ui-icon-seek-first'
    })
    .click(function (event) {
      event.stopPropagation()
      setPosition(0)
    })

  var moveBackwardButton = $('<button>')
    .appendTo(buttonPanel)
    .button({
      icon: 'ui-icon-seek-prev'
    })
    .click(function (event) {
      event.stopPropagation()
      setPosition(position - 1)
    })

  var playPauseHandler = function () {
    playing = !playing
    playPauseButton.button('option', 'icon', playing ? 'ui-icon-pause' : 'ui-icon-play')
    sliderPlayPauseButton.addClass(playing ? 'ui-icon-pause' : 'ui-icon-play')
    sliderPlayPauseButton.removeClass(playing ? 'ui-icon-play' : 'ui-icon-pause')
    if (playing) {
      // Move forward immediately, then set the interval function to carry on
      setPosition(position + 1)
      playIntervalId = setInterval(playTickHandler, playSpeed * 1000)
    } else {
      clearInterval(playIntervalId)
    }
  }

  var playTickHandler = function () {
    var oldPosition = position
    setPosition(position + 1)
    if (oldPosition === position) {
      // reached the end - stop
      playPauseHandler()
    }
  }

  var playPauseButton = $('<button>')
    .appendTo(buttonPanel)
    .button({
      icon: 'ui-icon-play'
    })
    .click(function (event) {
      event.stopPropagation()
      playPauseHandler()
    })

  var jumpLabel = $('<label>',
    {
      for: 'DataAnimatorJumpInput'
    })
    .css('margin-left', '3px')
    .html('Jump to:')
    .appendTo(buttonPanel)

  var jumpInput = $('<input>',
    {
      id: 'DataAnimatorJumpInput'
    })
    .css('margin-right', '3px')
    .appendTo(buttonPanel)
    .autocomplete({
      select: function (event, ui) {
        event.stopPropagation()
        if (ui) {
          setPosition(_.indexOf(jumpValues, ui.item.value))
        }
      }
    })

  var moveForwardButton = $('<button>')
    .appendTo(buttonPanel)
    .button({
      icon: 'ui-icon-seek-next'
    })
    .click(function (event) {
      event.stopPropagation()
      setPosition(position + 1)
    })

  var jumpEndButton = $('<button>')
    .appendTo(buttonPanel)
    .button({
      icon: 'ui-icon-seek-end'
    })
    .click(function (event) {
      event.stopPropagation()
      setPosition(indices.length)
    })

  var slider = $('<div>')
    .appendTo(buttonPanel)
    .css('width', '90%')
    .css('margin', 'auto')

  var sliderHandle = $('<div class="ui-slider-handle">')
    .appendTo(slider)

  var sliderPlayPauseButton = $('<span>')
    .appendTo(sliderHandle)
    .addClass('ui-icon')
    .addClass('ui-icon-play')
    .on('mousedown', function (event) {
      $(this).data('p0', { x: event.pageX, y: event.pageY })
    })
    .on('mouseup', function (event) {
      var p0 = $(this).data('p0')
      if (p0) {
        var p1 = { x: event.pageX, y: event.pageY }
        var d = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2))
        if (d < 4) {
          // We didn't drag, we clicked
          playPauseHandler()
        }
      }
    })

  slider.slider({
    min: 0,
    range: 'min',
    change: function (event, ui) {
      setPosition(ui.value)
    }
  })
}

function SpeedHandler (buttonPanel, markingHandler) {
  var currentSpeed
  var lastConfiguredSpeed

  this.setConfig = function (config) {
    if (config.playSpeed !== lastConfiguredSpeed) {
      lastConfiguredSpeed = config.playSpeed
      setSpeed(config.playSpeed)
    }
    playControlsPanel.css('visibility', config.showSpeedControls ? 'visible' : 'hidden')
  }

  function setSpeed (newSpeed) {
    newSpeed = Math.max(newSpeed, 0)
    if (currentSpeed !== newSpeed) {
      currentSpeed = newSpeed
      markingHandler.setPlaySpeed(currentSpeed)
      speedValueSpan.text(currentSpeed)

      fasterButton.button('option', 'disabled', (currentSpeed <= 0.5))
    }
  }

  var playControlsPanel = $('<div>')
    .css('padding-top', '5px')
    .appendTo(buttonPanel)

  var speedValueSpan = $('<span class=".ui-widget-content">')
    .appendTo(playControlsPanel)
    .text(currentSpeed)

  $('<span class=".ui-widget-content">')
    .appendTo(playControlsPanel)
    .html('&nbsp;second(s) between steps when playing&nbsp;')

  var fasterButton = $('<button>')
    .appendTo(playControlsPanel)
    .button({
      label: 'Faster'
    })
    .click(function (event) {
      event.stopPropagation()
      setSpeed((currentSpeed <= 1) ? 0.5 : currentSpeed - 1)
    })

  $('<button>')
    .appendTo(playControlsPanel)
    .button({
      label: 'Slower'
    })
    .click(function (event) {
      event.stopPropagation()
      setSpeed((currentSpeed < 1) ? 1 : currentSpeed + 1)
    })
}

// Called the first time (and only the first time) we render
function firstTimeSetup (data, config) {
  var selector = '#js_chart'

  var parent = $(selector)

  // make sure we don't get any scrollbars
  parent.css('overflow', 'hidden')

  // Setup the buttons
  var buttonPanel = $('<div>')
    .appendTo(parent)
    .css('width', '100%')
    .css('height', '100%')
    .css('z-index', 999)
    .css('text-align', 'center')
    .mousedown(function (event) {
      // Stop JSViz from marking when we click the button
      event.stopPropagation()
    })

  // Add the buttons
  divAbove = $('<div>')
    .appendTo(buttonPanel)
    .css('margin-bottom', '3px')
  markingHandler = new MarkingHandler(buttonPanel)
  speedHandler = new SpeedHandler(buttonPanel, markingHandler)
  divBelow = $('<div>')
    .appendTo(buttonPanel)
    .css('margin-top', '3px')
}

// Main render method
function render (data, config) {
  // Capture the current data and config in case it changed
  markingHandler.setupFromData(data, config)
  speedHandler.setConfig(config)
  divAbove.html(config.htmlAbove)
  divBelow.html(config.htmlBelow)
}
