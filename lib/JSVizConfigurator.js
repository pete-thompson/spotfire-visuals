// Code to support configuration of our custom charts

var $ = require('jquery')
require('jquery-ui/ui/widgets/button.js')
require('jquery-ui/ui/widgets/dialog.js')
require('jquery-ui/ui/widgets/selectmenu.js')
require('jquery-ui/ui/widgets/tabs.js')
require('jquery-ui/themes/base/all.css')
require('colorjoe/css/colorjoe.css')
require('jquery.shorten/src/jquery.shorten.js')
var d3 = require('d3-color')
var _ = require('underscore')
var colorjoe = require('colorjoe')

var showingConfigurator = false

module.exports.SetupConfigurator = function (title, instructions, configOptions, currentConfig, defaultConfig, exporting) {
  // Preprocess the options to convert any default values for colors into hex format since color input uses hex
  configOptions.forEach(function (option) {
    if (option.type === 'color') {
      var color = d3.color(defaultConfig[option.name])
      defaultConfig[option.name] = '#' +
              ('0' + color.r.toString(16)).slice(-2) +
              ('0' + color.g.toString(16)).slice(-2) +
              ('0' + color.b.toString(16)).slice(-2)
    }
  })

  if ((window.proClient || (window.location.host === '') || (window.location.host.lastIndexOf('localhost', 0) === 0)) && (!exporting) && !(currentConfig.disableConfiguration) && (configOptions.length > 0)) {
    // We're running inside Analyst (localhost) or a test harness (empty host) - show the configuration button and allow use of configuration
    showingConfigurator = true

    // Check if we're already loaded
    if ($('#JSVizConfigForm').length === 0) {
      // Create the form
      $('<div>')
        .attr('id', 'JSVizConfigForm')
        .appendTo('#js_chart')

      // Set up as a dialog
      $('#JSVizConfigForm')
        .dialog({
          autoOpen: false,
          closeOnEscape: false,
          width: Math.min(500, $('#js_chart').width() - 20),
          modal: true,
          title: title,
          buttons: {
            'OK': function () {
              var answer = {}
              configOptions.forEach(function (option) {
                var value = ''
                var input = $('#QIConfigField-' + option.name)

                if (option.type === 'checkbox') {
                  if (input.prop('checked')) {
                    value = (option.valueIfChecked === undefined) ? true : option.valueIfChecked
                  } else {
                    value = option.valueIfUnchecked || false
                  }
                } else {
                  value = input.val()
                }
                if ((value !== undefined) && (value !== defaultConfig[option.name])) {
                  answer[option.name] = value
                }
              })

              // Send the updated config to Spotfire
              window.setConfig(JSON.stringify(answer))

              // Close the dialog
              $(this).dialog('close')
            },
            'Cancel': function () {
              $(this).dialog('close')
            }
          },
          open: function (event, ui) {
            $('.ui-dialog-titlebar-close', ui.dialog | ui).hide()
          }
        })

      // Add the "Configure" button to the page
      $('<button>')
        .appendTo('body')
        .button({
          label: 'Configure'
        })
        .css('position', 'absolute')
        .css('x', '0')
        .css('y', '0')
        .css('z-index', 999)
        .click(function (event) {
          $('#JSVizConfigForm').dialog('open')
          event.stopPropagation()
        })
        .mousedown(function (event) {
          // Stop JSViz from marking when we click the button
          event.stopPropagation()
        })

      // Show instructions
      if ((instructions !== undefined) && (instructions.length !== 0)) {
        if (Array.isArray(instructions)) instructions = instructions.join('')
        $('<div>').html(instructions).appendTo('#JSVizConfigForm').shorten()
      }

      // Create a popup for colors
      var currentColorPicker
      var colorjoePicker
      var colorForm = $('<div>')
        .attr('id', 'JSVizColorForm')
        .appendTo('#js_chart')
        .dialog({
          autoOpen: false,
          closeOnEscape: true,
          modal: true,
          title: 'Color picker',
          width: 'auto',
          height: 'auto',
          buttons: {
            'OK': function () {
              currentColorPicker.val(colorjoePicker.get().hex())
              $(this).dialog('close')
            },
            'Cancel': function () {
              $(this).dialog('close')
            }
          },
          open: function (event, ui) {
            // Hide the close button in the title bar
            $('.ui-dialog-titlebar-close', ui.dialog | ui).hide()
          },
          create: function (event, ui) {
            var colorDiv = $('<div>')
              .appendTo($(this))
            colorjoePicker = colorjoe.rgb(colorDiv[0])
          }
        })

      // Now create the tabs
      var groups = _.groupBy(configOptions, 'tab')

      var tabContainer = $('<div>').appendTo('#JSVizConfigForm')

      var tabList
      if (_.size(groups) > 1) {
        tabList = $('<ul>').appendTo(tabContainer)
      }

      var tabNumber = 0
      _.each(groups, function (group, tabName) {
        tabNumber++
        var tabId = 'JSVizConfigTab' + tabNumber
        // If we have more than one tab make sure to add the reference in the list
        if (tabList) {
          $('<a>').appendTo($('<li>').appendTo(tabList))
            .append('<a>')
            .attr('href', '#' + tabId)
            .text(tabName)
        }

        // Create a new tab (or use as the main tab if there's only one)
        var table = $('<div>')
          .appendTo(tabContainer)
          .attr('id', tabId)
          .css('display', 'table')
          .css('border-collapse', 'collapse')

        // Add prompts to the form
        group.forEach(function (option) {
          // We lay things out in tables, with each option on a separate row
          var row = $('<div>')
            .appendTo(table)
            .css('display', 'table-row')

          var fieldId = 'QIConfigField-' + option.name

          var cell = $('<div>').appendTo(row).css('display', 'table-cell').css('padding', '3px')
          // Put the label in the left cell
          $('<label>', {
            for: fieldId
          }).html(option.caption)
            .appendTo(cell)

          // Put the input in the middle cell
          cell = $('<div>').appendTo(row).css('display', 'table-cell').css('padding', '3px')
          var input

          if (option.type.substr(0, 6) === 'column') {
            input = $('<select>', {
              id: fieldId
            }).appendTo(cell)
              .css('class', 'text ui-widget-content ui-corner-all')

            input.selectmenu()
          } else if (option.type === 'select') {
            input = $('<select>', {
              id: fieldId
            }).appendTo(cell)
              .css('class', 'text ui-widget-content ui-corner-all')

            option.options.forEach(function (option) {
              $('<option>', {
                value: option.value
              }).text(option.text)
                .appendTo(input)
            })

            input.selectmenu()
          } else if (option.type === 'color') {
            input = $('<input>', {
              id: fieldId
            })
              .appendTo(cell)
              .css('class', 'text ui-widget-content ui-corner-all')
            $('<button>').button({
              icon: 'ui-icon-pencil'
            }).css('padding', '1px')
              .appendTo(cell)
              .on('click', function () {
                currentColorPicker = input
                colorjoePicker.set(input.val())
                colorForm.dialog('open')
              })
          } else if (option.type === 'multiline') {
            input = $('<textarea>', {
              id: fieldId
            })
              .appendTo(cell)
          } else {
            input = $('<input>', {
              type: option.type,
              id: fieldId
            })
              .appendTo(cell)
              .css('class', 'text ui-widget-content ui-corner-all')
          }

          if (option.type === 'checkbox') {
            input.change(function () {
              // Update the enabled status of anything linked to this checkbox
              var checked = $(this).prop('checked')
              configOptions.forEach(function (otherOption) {
                if (otherOption.enabledIfChecked === option.name || otherOption.disabledIfChecked === option.name) {
                  var otherInput = $('#QIConfigField-' + otherOption.name)
                  var disabled = otherOption.enabledIfChecked ? !checked : checked
                  if (otherOption.type.substr(0, 6) === 'column' || otherOption.type === 'select') {
                    otherInput.selectmenu('option', 'disabled', disabled)
                  } else {
                    otherInput.prop('disabled', disabled)
                    if (disabled) {
                      otherInput.addClass('ui-state-disabled')
                    } else {
                      otherInput.removeClass('ui-state-disabled')
                    }
                  }
                }
              })
            })
          }

          if (option.hasOwnProperty('inputAttributes')) {
            input.attr(option.inputAttributes)
          }

          // Add a button to reset the value to default
          cell = $('<div>').appendTo(row).css('display', 'table-cell').css('padding', '3px')
          $('<button>')
            .appendTo(cell)
            .button({
              icon: 'ui-icon-arrowreturnthick-1-w'
            }).css('padding', '1px')
            .click(function () {
              $('#' + fieldId).val(defaultConfig[option.name])

              if ((option.type.substr(0, 6) === 'column') || (option.type === 'select')) {
                $('#' + fieldId).selectmenu('refresh')
              }
            })
        })
      })

      // Enable the tabs
      if (tabList) {
        tabContainer.tabs()
      }
    }
  }
}

// Set the columns - we need to support doing this each time Spotfire sends the render event because columns may change during setup
var oldColumns = []
module.exports.SetColumns = function (configOptions, columns) {
  if ((showingConfigurator) && (!_.isEqual(oldColumns, columns))) {
    oldColumns = columns
    configOptions.forEach(function (option) {
      if (option.type.substr(0, 6) === 'column') {
        var input = $('#QIConfigField-' + option.name)
        input.find('option').remove().end()
        columns.forEach(function (column, index) {
          $('<option>', {
            value: option.type === 'column' ? column : index
          }).text(column)
            .appendTo(input)
        })
        input.selectmenu('refresh')
      }
    })
  }
}

// Set the content of the form to match the current configuration
module.exports.SetConfig = function (configOptions, currentConfig, defaultConfig) {
  if (showingConfigurator) {
    configOptions.forEach(function (option) {
      var fieldId = 'QIConfigField-' + option.name
      var val
      if (currentConfig.hasOwnProperty(option.name)) {
        val = currentConfig[option.name]
      } else {
        val = defaultConfig[option.name]
      }

      var element = $('#' + fieldId)

      if (option.type === 'checkbox') {
        var newVal = val === ((option.valueIfChecked === undefined) ? true : option.valueIfChecked)
        if (element.prop('checked') !== newVal) {
          element.prop('checked', newVal).change()
        }
      } else {
        var oldVal = element.val()
        element.val(val)

        if (((option.type.substr(0, 6) === 'column') || (option.type === 'select')) && (oldVal !== val)) {
          element.selectmenu('refresh')
        }
      }
    })
  }
}

// Check if the configuration dialog is visible - used for ignoring marking events
module.exports.ConfiguratorVisible = function () {
  return ($('#JSVizConfigForm').dialog('isOpen') === true)
}
