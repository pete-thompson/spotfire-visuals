/*
 Copyright (c) 2016-9 TIBCO Software Inc

 THIS SOFTWARE IS PROVIDED BY TIBCO SOFTWARE INC. ''AS IS'' AND ANY EXPRESS OR
 IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT 
 SHALL TIBCO SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, 
 EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, 
 OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 
 Version: 3.5.1.0
 Date: 05/15/2019
*/

//////////////////////////////////////////////////////////////////////////////
// #region Helper Functions
//

/**
 * Log a message.
 *
 * @param {string} message The message being sent.
 * @see JSViz User Guide Appendix B
 */
function log ( message )
{
    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.read ( "log", message, function () {} );
    }
}

/**
 * Mark a  set of indices.
 *
 * @param {object} markData Marking data
 * @see JSViz User Guide Appendix B
 */
function markIndices ( markData )
{
    var markDataJSON = JSON.stringify ( markData );

    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.modify ( "mark", markData );
    }
}

/**
 * Mark a  set of indices.
 *
 * @param {object} markData Marking data
 * @see JSViz User Guide Appendix B
 */
function markIndices2 ( markData )
{
    var markDataJSON = JSON.stringify ( markData );

    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.modify ( "mark2", markData );
    }
}

/**
 * Set the visualization configuration parameters.
 *
 * @param {object} configObject Configuration data
 * @see JSViz User Guide Appendix B
 */
function setConfig ( configObject )
{
    var configJSON = JSON.stringify ( configObject );

    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.modify ( "config", configObject );
    }
}

/**
 * Set a Spotfire Document Property.
 *
 * @param {string} name Document Property to be changed
 * @param {object} value Document Property Value
 * @see JSViz User Guide Appendix B
 */
function setDocumentProperty ( name, value )
{
    var DocumentPropertyInfo = { "PropertyName": name, "PropertyValue": value };
    var dpiJson = JSON.stringify ( DocumentPropertyInfo );
 
    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.modify ( "documentproperty", DocumentPropertyInfo );
    }
}

/**
 * Set the visualization runtime state.
 *
 * @param {object} stateObject Runtime State data
 * @see JSViz User Guide Appendix B
 */
function setRuntimeState ( stateObject )
{
    var stateJSON = JSON.stringify ( stateObject );

    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.modify ( "runtime", stateObject );
    }
}

/**
 * Run an IronPython Script with the specified Parameters.
 *
 * @param {string} name Name of the IronPython Script to run
 * @param {object} args Script Arguments 
 * @see JSViz User Guide Appendix B
 */
function runScript ( name, args )
{
    var ScriptExecutionInfo = { "ScriptName": name, "Arguments": args };
    var seiJson = JSON.stringify ( ScriptExecutionInfo );

    if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
    {
        // Spotfire 7.5 or higher:
        Spotfire.modify ( "script", ScriptExecutionInfo );
    }
}

/**
 * Read a set of data rows for a given Data Setting.
 *
 * @param {object} dataArray Array to receive data rows
 * @param {string} dataSettingName Name of the Data Setting to read data for
 * @param {number} startIdx Starting Row Index
 * @param {number} endIdx Ending Row Index
 * @param {number} pageSize Block size to use when reading data rows
 * @return {Promise} JS Promise which will be settled once data transfer has either completed or failed
 * @see JSViz User Guide Chapter 13
 */
function readPagedRowsOnRequest ( dataArray, dataSettingName, startIdx, endIdx, pageSize )
{
    var dataDict =
    {
        "name"     : dataSettingName ,
        "min"      : startIdx,
        "max"      : endIdx,
        "pageSize" : pageSize 
    };
    
    return readPagedRows ( dataArray, dataDict );
}

var req_promises = [];       // Array for asynchronous data loading promises
/**
 * Read a set of data rows for a given Data Setting and call a function when done.
 *
 * @param {object} dataArray Array to receive data rows
 * @param {string} dataSettingName Name of the Data Setting to read data for
 * @param {number} startIdx Starting Row Index
 * @param {number} endIdx Ending Row Index
 * @param {number} pageSize Block size to use when reading data rows
 * @param {object} callback Function to call when data read has completed
 * @return {Promise} JS Promise which will be settled once data transfer has either completed or failed
 * @see JSViz User Guide Chapter 13
 */
function readPagedRowsOnRequest_cb ( dataArray, dataSettingName, startIdx, endIdx, pageSize, callBack )
{
    req_promises[dataSettingName] = [];
    req_promises[dataSettingName].push ( readPagedRowsOnRequest ( dataArray, dataSettingName, startIdx, endIdx, pageSize ) );

    jQuery.when.apply ( jQuery, req_promises[dataSettingName] ).then( function ()
    {
        setProgress ( false );
        setBusy( false );

        callBack ();
    });
}

/**
 * Set the Spotfire busy flag for Spotfire Version 7.10 and later.
 *
 * @param (boolean) True to set busy flag, false to clear.
 * @see JSViz User Guide Chapter 15 Exporting and Printing
 */
function setBusy ( busy )
{
    if ( typeof ( Spotfire ) != 'undefined' &&  typeof ( Spotfire.setBusy ) != 'undefined' )
    {
        Spotfire.setBusy ( busy );
    }
}

/**
 * Wait for rendering to settle before export.
 *
 * @param (number) Time to wait in seconds
 * @param (boolean) True if visualization is being Exported or Printed, False otherwise.
 * @see JSViz User Guide Chapter 15 Exporting and Printing
 */
var waiter;
var accumulatedWait = 0; // ms
var interval = 250;      // ms

function wait ( waitTime, isStatic )
{
    if ( !isStatic || waitTime <= 0 || JSViz.version.major < 3 )
    {
        return;
    }

    if ( typeof ( Spotfire ) != 'undefined' &&  typeof ( Spotfire.setBusy ) != 'undefined' )
    {
        //
        // Spotfire 7.10 or later with Spotfire.setBusy() logic
        //
        setBusy ( true );

        window.setTimeout ( function () { setBusy ( false ); }, waitTime * 1000 );

        return; 
    }
    else
    {
        //
        // Spotfire 7.9 or older
        //
        accumulatedWait = 0; // Reset accumulated wait for each invocation of renderCore
    
        function timer ()
        {
            //
            // Ping the server;
            //
            Spotfire.read ( "wait", function ( retval ) { return; } );
            //
            // Update the time waited
            //
            accumulatedWait = accumulatedWait + interval;

            if ( accumulatedWait >= ( waitTime * 1000 ) )
            {
                //
                // We have waited long enough.
                //
                window.clearInterval ( waiter );
            }
        }

        waiter = setInterval ( timer, interval );

        return;
    }
}

//
// #endregion Helper Functions
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// #region Spotfire 7.5 and higher
//

//
// This code performs initialization when running under Spotfire 7.5
//
var promises = [];       // Array for asynchronous data loading promises
var fetchedFirstPlotData = false;

if ( typeof ( JSViz ) != 'undefined' && JSViz.version.major >= 3 )
{
    //
    // The Spotfire 7.5 JavaScript visualization API generates a "SpotfireLoaded"
    // event when all the required objects are loaded and initialized.
    //
    jQuery ( window ).on ( "SpotfireLoaded", function ()
    {
        initMarking ();
	
        var render = function ()
        {
            promises.length = 0;

            setBusy ( true );
			
            Spotfire.read ( "data", {}, function ( data )
            {
                if ( data )
                {
                    var dataObject = JSON.parse ( data );

                    if ( dataObject.pageDataRows )
                    {
                        promises.push ( readPagedRows(dataObject.data, dataObject.baseTableHints.settingName) );
                    }

                    for ( var nIndex = 0 ; nIndex < dataObject.additionalTables.length ; nIndex++ )
                    {
                        var dataSetting = dataObject.additionalTables[nIndex];

                        if ( dataSetting.data, dataSetting.pageDataRows )
                        {
                            promises.push ( readPagedRows ( dataSetting.data, dataSetting.baseTableHints.settingName) );
                        }
                    }

                    jQuery.when.apply ( jQuery, promises ).then ( function ()
                    {
                        fetchedFirstPlotData = true;
                        setProgress ( false );
                        setBusy ( false );

                        renderCore ( dataObject );

                        wait ( dataObject.wait, dataObject.static );
                    });
                }
            });
        };

        Spotfire.addEventHandler ( "render", render );
        render ();
    });
}

// 
// #endregion Spotfire 7.5
//////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////////
// #region Marking Code
//

/**
 * Initiate marking rectangle functionality on body element.
 *
 * @see JSViz User Guide Chapter 13
 */
function initMarking ()
{
	jQuery ( "body" ).on ( "mousedown", function ( mouseDownEvent )
	{		
        var getMarkMode = function ( e )
        {
            // shift: add rows
            // control: toggle rows
            // none: replace rows
            if ( e.shiftKey )
            {
                return "Add";
            }
            else if ( e.ctrlKey )
            {
                return "Toggle";
            }

            return "Replace";
        };

        mouseDownEvent.preventDefault ();

        var markMode = getMarkMode ( mouseDownEvent );
        //
        // Create initial marking rectangle, will be used if the user only clicks.
        //
        var x = mouseDownEvent.pageX,
        y = mouseDownEvent.pageY,
        width = 1,
        height = 1;

        var $selection = jQuery("<div/>").css ( {
            'position': 'absolute',
            'border': '1px solid #0a1530',
            'background-color': '#8daddf',
            'opacity': '0.5'
        } ).hide ().appendTo ( this );

        jQuery ( this ).on ( "mousemove", function ( mouseMoveEvent )
        {
            x      = Math.min ( mouseDownEvent.pageX, mouseMoveEvent.pageX );
            y      = Math.min ( mouseDownEvent.pageY, mouseMoveEvent.pageY );
            width  = Math.abs ( mouseDownEvent.pageX - mouseMoveEvent.pageX );
            height = Math.abs ( mouseDownEvent.pageY - mouseMoveEvent.pageY );

            $selection.css ( {
                'left': x + 'px',
                'top': y + 'px',
                'width': width + 'px',
                'height': height + 'px'
            } );

            $selection.show ();
        } );

        jQuery ( this ).on ( "mouseup", function ()
        {
            var rectangle =  {
                'x': x,
                'y': y,
                'width': width,
                'height': height
            };
            //
            // markModel is (optionally) implemented in the visualization js code
            //
            if ( typeof ( markModel ) != 'undefined' )
            {
                markModel ( markMode, rectangle );
            }

            $selection.remove ();
            jQuery ( this ).off ( "mouseup mousemove" );
        });
    });
}

// 
// #endregion Marking Code
//////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////
// #region Data Paging Functions
//

/**
 * Read data rows in blocks or "pages".
 *
 * @param {object} dataArray Array to receive data rows
 * @param {string} dataSettingName Name of Data Setting to read data for
 * @param {object} data Not used
 * @return {Promise} JS Promise which will be settled once data transfer has either completed or failed
 * @see JSViz User Guide Chapter 13
 */
function readPagedRows ( dataArray, dataSettingName )
{
    var deferred = new jQuery.Deferred ();
    var promise  = deferred.promise ();

    Spotfire.read ( "initPaging", dataSettingName, function ( readerId )
    {
        if ( readerId != "NOTOK" )
        {
            setProgress ( true );

            readNextRows ( dataArray, readerId, deferred );
        }
    });

	
    return promise;
}

/**
 * Recursively read remaining data rows in blocks or "pages".
 *
 * @param {object} dataArray Array to receive data rows
 * @param {string} dataSettingName Name of Data Setting to read data for
 * @param {object} data Not used
 * @param {object} deferred JavaScript deferred object that will be resolved once data transfer is complete
 * @see JSViz User Guide Chapter 13
 */
function readNextRows ( dataArray, dataSettingName, deferred )
{
    Spotfire.read ( "nextRows", dataSettingName, function ( nextRows )
    {
        if ( nextRows == "END" )
        {
            deferred.resolve ();
        }
        else
        {
            var rows = jQuery.parseJSON ( "[" + nextRows + "]" );
            Array.prototype.push.apply ( dataArray, rows );
            readNextRows ( dataArray, dataSettingName, deferred );
        }
    });
}

/**
 * Controls the display of Progress indicator.
 *
 * @param {boolean} True to display progress indicator, false to hide.
 */
function setProgress ( bEnabled )
{
    if ( ( window.Spinner ) && ( typeof jQuery ( '#js_chart' ).spin == 'function' ) )
    {
        // Start or Stop the spinner.
        jQuery ( '#js_chart' ).spin ( bEnabled )
    }
}

// 
// #endregion Data Paging Functions
//////////////////////////////////////////////////////////////////////////////
