(function () {
    "use strict";

    var spa = {}; // Single-Page Application
    spa.history = []; // historia przeglądanych stron - tablica url
    var app = {}; 
    var mainView = $('main');

    app.onDeviceReady = function () {
        // Handle the Cordova pause and resume events
        document.addEventListener('pause', app.onPause, false);
        document.addEventListener('resume', app.onResume, false);
        document.addEventListener("backbutton", app.onBackKeyDown, false);

        spa.init();
        spa.route('mainPage.html');

    };

    app.onPause = function () {
        // TODO: This application has been suspended. Save application state here.
    };

    app.onResume = function () {
        // TODO: This application has been reactivated. Restore application state here.
    };

    app.onBackKeyDown = function () {
        if (spa.history.length > 1) // jeśli w tablicy są podstrony
            spa.route('back');
        else
            navigator.app.exitApp(); // zamknięcie aplikacji
    };

    app.mainPage = function (params) {
        console.log('init mainPage');
    };

    app.newAlbum = function (params) {
        console.log('init newAlbum');
    };
    

    spa.init = function () { // przechwicenie zdarzenia kliknięcia w link
        document.body.onclick = function (e) { // click event dla każego elementu strony
            e = e || window.event;
            var link = findLink(e.target || e.srcElement);
            if (link && link.getAttribute('href').indexOf('#') == -1) { // jeśli element jest linkiem i nie jest kotwicą (#)
                spa.route(link.getAttribute('href'));
                return false;
            }
        }
        function findLink(el) { // el - najniższy element
            if (el.tagName === 'A') // czy element jest linkiem - zwraca link
                return el; 
            while (el = el.parentNode) // dopóki element ma rodzica
                if (el.tagName === 'A')
                    return el;
            return null;
        }
    };

    spa.route = function (url) { // przekierowanie do podstrony
        url = spa.getParameters(spa.saveURL(url));
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url.page, true);
        xhr.onload = function (e) {
            var response = e.currentTarget;
            if (response.status == 200) { // strona została poprawnie wczytana
                mainView.innerHTML = response.responseText;
                var fun = url.page.split('.')[0]; // zwraca nazwę strony bez rozszerzenia
                if (fun === 'mainPage')
                    spa.mainPage();
                else
                    spa.subPage();

                if (app[fun])
                    app[fun](url.params); // wywołanie funkcji dla danej strony np.: app.nazwastrony() dla nazwastrony.html
            } else // błąd
                spa.history.pop();
        };
        xhr.onerror = function (e) {
            spa.history.pop();
        };
        xhr.send();
    };

    spa.getParameters = function (url) { // zwraca obiekt z nazwą strony i parametrami
        var page = url,
            params = {};

        if (url.indexOf('?') > 0) {
            page = url.split('?')[0];
            var query = url.split('?')[1].split('&');
            for (i = 0; i < query.length; i++) {
                param = query[i].split('=');
                params[param[0]] = param[1];
            }
        }
        return {
            page: page,
            params: params
        };
    };

    spa.saveURL = function (url) { // zapis url strony w tablicy spa.history
        if (url === 'back') {
            spa.history.pop();
            url = spa.history[spa.history.length - 1];
        } else
            spa.history.push(url);
        return url;
    };

    spa.subPage = function () { // wczytano podstronę
        $('backNav').innerHTML = '<a href="back"><i class="icon-left"></i></a>';
    };

    spa.mainPage = function () { // wczytano stronę główną
        $('backNav').innerHTML = '<i class="icon-paper-plane"></i>';
    };

    function $(id) {
        return document.getElementById(id);
    }

    document.addEventListener('deviceready', app.onDeviceReady, false); 

} )();