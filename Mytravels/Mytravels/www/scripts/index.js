(function () {
    "use strict";

    function $(id) {
        return document.getElementById(id);
    }

    document.addEventListener( 'deviceready', onDeviceReady, false );

    function onDeviceReady() {
        // Handle the Cordova pause and resume events
        document.addEventListener( 'pause', onPause, false );
        document.addEventListener( 'resume', onResume, false );
        
       
    };

    function onPause() {
        // TODO: This application has been suspended. Save application state here.
    };

    function onResume() {
        // TODO: This application has been reactivated. Restore application state here.
    };

} )();