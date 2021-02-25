// A test harness for JSViz based visualisation testing
// Simulates Spotfire behaviour in the browser

// Fool JSViz into thinking that it's running inside Spotfire
window.JSViz = {
  version: {
    major: 3,
    minor: 5
  }
};

(function (testHarness, $) {
  // Grabs test data by calling getTestData() - so when including this on the page also include a function that returns the JSON data obtained from Spotfire during testing
  var sfData
  // Remember the state of the configuration so we can adjust when calls are made to change configuration
  var lastConfig
  // Allow for a queue of requests
  var spotfireRequestQueue = []
  // Remember the last marking request
  var lastMarkData
  // Remember the current theme
  var currentStyle
  // Remember state of legend
  var legend
  // Remember the data itself so we can modify it
  var lastDataData
  // Callbacks for testing markings
  var markingCallbacks = []
  // Remember the original data so we can restore it
  var originalDataData


  // Set up the page - assumes that basically nothing in the HTML page for the tester
  $().ready(function () {
    $('head').append('<meta http-equiv="X-UA-Compatible" content="IE=edge" />')
      .append('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">')
      .append('<title>Tester</title>')

    sfData = window.getTestData()
    lastConfig = sfData.config
    spotfireRequestQueue = []
    currentStyle = sfData.style
    legend = sfData.legend
    lastDataData = sfData.data
    originalDataData = sfData.data

    // The Div to contain the jsviz chart
    $('body').append('<div style="position: absolute; width: 100%; height: 100%; top: 0px; left: 0px;" id="js_chart" />')

    // Simulate what happens when the page completes loading
    window.initMarking()
    window.renderCore(sfData)
  })

  // A dialog for our UI components
  var testerDialog = $('<div>').appendTo('body')

  var logDiv = $('<div>').appendTo(testerDialog)
    .css('height', '100%')
    .css('width', '100%')
    .css('overflow', 'auto')

  testerDialog.dialog({
    draggable: true,
    resizable: true,
    width: 500,
    height: 300,
    title: 'Test harness',
    position: { my: 'right bottom', at: 'right bottom', of: window },
    open: function (event, ui) { $('.ui-dialog-titlebar-close').hide() }
  })

  testerDialog.dialog('widget').mousedown(function (event) {
    // Stop JSViz from marking when we interact with the dialog
    event.stopPropagation()
  })

  // Capture console logging
  var oldConsoleLog = console.log
  console.log = function () {
    oldConsoleLog(arguments)
    var msg = ''
    $.each(arguments, function (i, arg) {
      msg += arg
    })
    logDiv.append('<div>' + msg + '</div>')
  }

  window.Spotfire = {
    // Capture calls to the Busy function and log to console
    setBusy: function (busy) {
      console.log('Spotfire.setBusy called with value: ', busy)
    },
    modify: function (message, content) {
      var request = {
        message: message,
        content: content
      }
      console.log('Posting request: ' + JSON.stringify(request))
      spotfireRequestQueue.push(request)

      // Run everything a little later to mimic the asynchronous nature of the calls to the server
      window.setTimeout(processSpotfireRequest, 1000)
    }
  }

  // A method to allow us to simulate asynchronous handling of messages sent to the server
  function processSpotfireRequest () {
    var thisRequest = spotfireRequestQueue[0]
    spotfireRequestQueue.shift()

    console.log('Processing request: ' + JSON.stringify(thisRequest))
    // Recreate the data so that we mimic what happens when the server responds - the visualisation gets an entirely new object to work on
    sfData = window.getTestData()
    sfData.config = lastConfig
    sfData.style = currentStyle
    sfData.legend = legend
    sfData.data = lastDataData

    if (thisRequest.message === 'mark') {
      lastMarkData = thisRequest.content
    }
    // We need to process the marking data every time we call this method because we've reverted to the original test harness data
    if (lastMarkData) {
      // Sometimes we send mark indices as strings, which is fine except we need numbers here...
      var indexSet = lastMarkData.indexSet.map(Number)
      // Now update to set marked rows
      var markedCount = 0
      switch (lastMarkData.markMode) {
        case 'Add':
          sfData.data.forEach(function (d) {
            d.hints.marked = d.hints.marked || ($.inArray(d.hints.index, indexSet) !== -1)
            if (d.hints.marked) markedCount++
          })
          break
        case 'Replace':
          sfData.data.forEach(function (d) {
            d.hints.marked = ($.inArray(d.hints.index, indexSet) !== -1)
            if (d.hints.marked) markedCount++
          })
          break
        case 'Toggle':
          sfData.data.forEach(function (d) {
            if ($.inArray(d.hints.index, indexSet) !== -1) {
              d.hints.marked = !d.hints.marked
              if (d.hints.marked) markedCount++
            }
          })
          break
        default:
          break
      }
      sfData.baseTableHints.marked = markedCount
      // Call any registered marking handlers
      if (thisRequest.message === 'mark') {
        markingCallbacks.forEach(function (callback) {
          callback(sfData)
        })
      }
    }

    if (thisRequest.message === 'config') {
      sfData.config = JSON.parse(thisRequest.content)
      // Save it so that if we run marking later we use our updated copy
      lastConfig = sfData.config
    }

    window.renderCore(sfData)
  }

  // Allow custom pages to capture events when marking changes
  // Callbacks should simply accept a Spotfire data object
  testHarness.AddMarkingCallback = function (callback) {
    markingCallbacks.push(callback)
  }

  // Add buttons on the page that simulate changing between light and dark themes, enables/disables legends, randomizing data, filtering and switching to web player mode
  $().ready(function () {
    var testButtons = $('<div>').appendTo(testerDialog)
      .css('position', 'absolute')
      .css('left', '0')
      .css('bottom', '0')
      .css('z-index', 999)

    $('<button>').appendTo(testButtons)
      .text('Switch theme')
      .click(function (e) {
        e.stopPropagation()
        if ($('body').css('color') === 'rgb(0, 0, 0)') {
          currentStyle = 'font-family:"Arial",sans-serif;font-size:11px;font-style:Normal;font-weight:Normal;color:#C8C8C8;background-color:#2a2a2a;border-style:None;border-top-color:#FFFFFF;border-right-color:#FFFFFF;border-bottom-color:#FFFFFF;border-left-color:#FFFFFF;border-top-width:0px;border-right-width:0px;border-bottom-width:0px;border-left-width:0px;border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-right-radius:0px;border-bottom-left-radius:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px;'
        } else {
          currentStyle = 'font-family:"Arial",sans-serif;font-size:11px;font-style:Normal;font-weight:Normal;color:#000000;background-color:transparent;border-style:None;border-top-color:#FFFFFF;border-right-color:#FFFFFF;border-bottom-color:#FFFFFF;border-left-color:#FFFFFF;border-top-width:0px;border-right-width:0px;border-bottom-width:0px;border-left-width:0px;border-top-left-radius:0px;border-top-right-radius:0px;border-bottom-right-radius:0px;border-bottom-left-radius:0px;padding-top:0px;padding-bottom:0px;padding-left:0px;padding-right:0px;margin-top:0px;margin-bottom:0px;margin-left:0px;margin-right:0px;'
        }
        sfData.style = currentStyle
        window.renderCore(sfData)
      })

    $('<button>').appendTo(testButtons)
      .text('Switch legend on/off')
      .click(function (e) {
        e.stopPropagation()
        legend = !legend
        sfData.legend = legend
        window.renderCore(sfData)
      })

    $('<button>').appendTo(testButtons)
      .text('Randomize data')
      .click(function (e) {
        e.stopPropagation()

        lastDataData.forEach(function (row) {
          row.items.forEach(function (item, index) {
            if (typeof item === 'number') {
              row.items[index] = Math.random() * 100
            }
          })
        })

        sfData.data = lastDataData

        window.renderCore(sfData)
      })

    $('<button>').appendTo(testButtons)
      .text('Filter data')
      .click(function (e) {
        e.stopPropagation()

        lastDataData = lastDataData.filter(function () {
          return (Math.random() > 0.5)
        })

        sfData.data = lastDataData

        window.renderCore(sfData)
      })

    $('<button>').appendTo(testButtons)
      .text('Mark random data')
      .click(function (e) {
        e.stopPropagation()

        lastDataData.forEach(function (row) {
          row.hints.marked = (Math.random() > 0.5)
        })

        sfData.data = lastDataData

        window.renderCore(sfData)
      })

    $('<button>').appendTo(testButtons)
      .text('Restore original data')
      .click(function (e) {
        e.stopPropagation()

        lastDataData = originalDataData

        sfData.data = lastDataData

        window.renderCore(sfData)
      })

    $('<button>').appendTo(testButtons)
      .text('Toggle configuration on/off')
      .click(function (e) {
        e.stopPropagation()

        sfData.config.disableConfiguration = !sfData.config.disableConfiguration

        window.renderCore(sfData)
      })
  })
} (window.TestHarness = window.TestHarness || {}, jQuery))
