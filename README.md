# README #

# Introduction

This repository contains various JavaScript based visualisations that can be used with the JSViz extension.

The philosophy behind these visualisations is to make them simple to use and configure - a user shouldn't need to understand JavaScript, HTML, JSON or CSS in order to make use of the charts.

This is achieved (as far as possible) through the following common features:
* Each visualisation builds to a single minified JavaScript file containing all dependencies. Adding the visual to JSViz is then a simple case of adding one JavaScript reference, as opposed to adding D3.js, JQuery etc. independently.
* Each visualisation allows for configuration within Spotfire Analyst using a form generated through JQueryUI, rather than requiring the user to write any JavaScript or enter JSON data.
* The visualisations automatically load and render when added to JSViz - again there's no need to write any HTML, JavaScript etc.
* Visualisations attempt to respond to Spotfire themes, removing the need to edit CSS.

Secondarily, effort has been placed into making the development process as simple as possible:
* A test harness has been created that supports testing responses to marking events, theming etc.
* Helper scripts handle all the configuration interaction, dealing with common marking scenarios etc.
* Build scripts have been created to automate the creation of minified packed versions of the visualisation scripts.

# Developing

* You'll require Node.js and npm (usually installed with Node.js)
* From command line execute 'npm install' to install command line utilities for testing.
* Run 'npm run build:dev' from a command line to set up the build process which will automatically update the files in the /build folder when source files are edited. Any syntax errors or lint failures will be displayed by the build command line.
* Test using test harnesses within a browser - they will render the version of the visual from the /build folder.

# Adding a visualisation

* Create new JavaScript file in the visuals folder. At a minimum reference the JSVizHelper and implement call to the SetupViz method - which will require code for rendering.
* Create new test harness HTML in the Test Harness folder
* Update webpack-config/base.js to include a new "entry" value for the new file.

# Features of the test harnesses

* Automatically creates DOM elements to house the visualisation - the wrapper HTML script can be very simple.
* Captures any requests that would normally be sent to the Spotfire servers and writes them to the JavaScript console.
* Handles marking requests that would normally be sent to the server and responds by causing the visualisation to re-render with the appropriate rows marked.
* Adds a button on the page that simulates switching between light and dark Spotfire themes.
* Adds a button on the page that simulates enabling/disabling the legend.
* Adds a button on the page that randomises the data being sent to the visualisation (detects any numeric columns and places random values into them).

# Features of JSVizHelper

* Supports common marking scenarios automatically. It can mark based on clicks/drags on SVG or HTML elements - simply assign a data-id attribute on each element that contains the row's index hint value.
* Breaks the flow of rendering into 'firstTimeSetup' (intended for creation of elements) and 'render' to actually render data. The 'render' method may be called multiple times if the data changes (e.g. marking, filtering, changing configuration).
* Provides configuration forms that can be accessed from within Spotfire Analyst.

# Easy example

Take a look at /visuals/JSVizImageViewer.js - this visualisation simply renders images based on URLs in the data.

# Configuration forms

When you call JSVizHelper from your visualisation you will specify the properties that can be configured, along with header and instructions for the configuration form. Each property has a datatype and caption which dictate the way that the user is prompted. The following attributes of a property are supported:
* name - the property name - configuration can be referenced as ```config.<name>``` in the render function.
* caption - the user visible caption on the form.
* type - one of 'checkbox', 'color', 'select', 'column' or a valid type for an ```<input>``` element (e.g. 'text', 'number'). The 'color' type uses a built-in colour picker, the 'column' type uses a select menu with all the column names found in the Spotfire data.
* inputAttributes - these attributes will be assigned to the ```<input>``` element used for prompting, thus any valid attribute is supported (e.g. min/max for number inputs).
* options - an array of options when using a type of 'select'. Each option should have a 'value' and a 'text' attribute.
* tab - the name of the tab within the form (supporting multi-tab forms).
* valueIfChecked/valueIfUnchecked - values to use for checkbox type prompts.
* enabledIfChecked/disabledIfChecked - these can be used to enable/disable prompts based on whether other properties have been checked/unchecked, simply specify the name of the property as the value for these attributes.
