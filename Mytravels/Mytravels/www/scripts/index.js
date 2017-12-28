(function () {
    "use strict";

    var spa = { // Single-Page Application
            history: [] // historia przeglądanych stron - tablica url
        },
        app = {
            isOnline: false,
            pictureList: [],
            isMapScriptLoaded: false
        },
        mainView = $('main');


    app.onDeviceReady = function () {
        document.addEventListener("backbutton", app.onBackKeyDown, false);
        document.addEventListener("offline", app.offline, false);
        document.addEventListener("online", app.online, false);

        app.openDatabase(function () {
            app.createFolders(function () {
                app.init();
            });
        });
    };

    app.init = function () {
        app.checkInternetStatus();
        spa.init();
        spa.route('mainPage.html');
    };

    app.checkInternetStatus = function () {
        if (navigator.connection.type === Connection.NONE)
            app.isOnline = false;
        else
            app.isOnline = true;
    }

    app.offline = function () {
        app.isOnline = false;
    };

    app.online = function () {
        app.isOnline = true;
    };

    app.onBackKeyDown = function () {
        if (spa.history.length > 1) // jeśli w tablicy są podstrony
            spa.route('back');
        else
            navigator.app.exitApp(); // zamknięcie aplikacji
    };

    app.openDatabase = function (onSuccess) {
        app.db = window.sqlitePlugin.openDatabase({ name: 'mytravels.db', location: 'default' }, function (db) {
            db.transaction(function (tx) {
                //tx.executeSql('DROP TABLE IF EXISTS album');
                //tx.executeSql('DROP TABLE IF EXISTS picture');
                //tx.executeSql('DROP TABLE IF EXISTS tag');
                //tx.executeSql('DROP TABLE IF EXISTS tag_relationship');
                tx.executeSql('CREATE TABLE IF NOT EXISTS album (id integer primary key autoincrement, name text, description text)');
                tx.executeSql('CREATE TABLE IF NOT EXISTS picture (id integer primary key autoincrement, album_id integer, path text, thumbnail_path text, date datetime default (datetime(\'now\', \'localtime\')), latitude Decimal(8,6), longitude Decimal(9,6), weather text )');
                tx.executeSql('CREATE TABLE IF NOT EXISTS tag (id integer primary key autoincrement, name text)');
                tx.executeSql('CREATE TABLE IF NOT EXISTS tag_relationship (tag_id integer, picture_id integer)');

            }, function (error) {
                app.onError('Nie mażna utworzyć tabel');
            }, onSuccess);
        }, function (error) {
            app.onError('Nie można utworzyć bazy danych');
        });
    };

    app.createFolders = function (onSuccess) {
        var saveFolder = 'albums', // nazwa folderu gdzie będą zapisywane zdjęcia
            thumbnailsFolder = 'thumbnails', //nazwa folderu na miniaturki zdjęć
            rootPath = (cordova.platformId === 'windows') ? cordova.file.dataDirectory : cordova.file.externalDataDirectory;

        app.mainPath = rootPath + saveFolder;
        app.thumbnailsPath = rootPath + thumbnailsFolder;

        createFolder(saveFolder, function () {
            createFolder(thumbnailsFolder, onSuccess);
        });

        function createFolder(folderName, createSuccess) {
            window.resolveLocalFileSystemURL(rootPath, function (fileSys) {
                fileSys.getDirectory(folderName, { create: true, exclusive: false }, function (directory) { //wybiera folder o nazwie folderName, jeśli nie znajdzie to go utworzy
                    createSuccess();
                }, onError.bind(null, saveFolder));
            }, onError.bind(null, saveFolder));
        }

        function onError(folderName) {
            app.onError('Błąd utworzenia folderu: ' + folderName);
        }
    };

    app.mainPage = function (params) {
        $('title').innerText = 'My Albums';

        app.db.executeSql("SELECT * FROM album ORDER BY id DESC", [], function (res) {
            var output = '';
            for (var i = 0; i < res.rows.length; i++) {
                output += '<a href="album.html?id=' + res.rows.item(i).id +
                    '" class="button-list">' + res.rows.item(i).name + '</a>';
            }

            if (res.rows.length)
                $('albumList').innerHTML = output;
            else
                $('albumList').innerHTML = '<div class="list-info">Brak</div>';
        });
    };

    app.newAlbum = function (params) {
        $('title').innerText = 'Dodaj nowy album';

        var form = $('addAlbum'); // formularz
        form.addEventListener("submit", addAlbum, false);

        function addAlbum(e) {
            e.preventDefault();
            var name = $('name').value.trim().replace(/\W/g, ' ').replace(/\s+/g, ' ').substring(0, 100); //białe znaki, tylko alfanumeryczne i zamienia wiele spacji na jedną, max 100 znakow
            var description = $('description').value;

            if (name !== "") {
                app.db.executeSql("INSERT INTO album (name, description) VALUES (?,?)", [name, description], function (res) {
                    alert('Dodano!');
                    spa.route('back');
                }, function (error) {
                    app.onError('Błąd. Nie zapisano');
                });
            } else {
                app.onError('Podaj nazwę albumu');
            }
        }
    };

    app.album = function (params) {
        var album,
            newPicture = {
                latitude: '',
                longitude: '',
                weather: ''
            },
            exifData = {},
            CAMERA = Camera.PictureSourceType.CAMERA,
            PHOTOLIBRARY = Camera.PictureSourceType.PHOTOLIBRARY,
            endGetPosition = false;

        app.db.executeSql("SELECT * FROM album WHERE id = ?", [params.id], function (res) {
            if (res.rows.length)
                albumPageInit(res.rows.item(0));
            else
                app.onError('Nie znaleziono albumu');
        });

        function albumPageInit(row) {
            album = row;

            $('title').innerText = album.name;
            $('albumDesc').innerHTML = album.description;

            $('takePhoto').addEventListener('click', function () {
                newPicture.source = CAMERA;
                getCamera(CAMERA);
            }, false);

            $('getPhoto').addEventListener('click', function () {
                newPicture.source = PHOTOLIBRARY;
                getCamera(PHOTOLIBRARY);
            }, false);

            $('map').setAttribute('href', 'albumMap.html?id=' + album.id);

            getPictures();

        }

        function getPictures() {
            app.db.executeSql("SELECT * FROM picture WHERE album_id = ? ORDER BY id DESC", [album.id], function (res) {
                app.pictureList = [];
                var output = '';
                for (var i = 0; i < res.rows.length; i++) {
                    output += '<a href="photo.html?id=' + res.rows.item(i).id +
                        '"><img src="' + res.rows.item(i).thumbnail_path + '" /></a>';
                    app.pictureList.push(res.rows.item(i));
                }

                if (res.rows.length)
                    $('photoList').innerHTML = output;
                else
                    $('photoList').innerHTML = '<div class="list-info">Brak</div>';

                $('photoCount').innerText = res.rows.length;
            });
        }

        function getCamera(source) {
            app.showLoader();

            navigator.camera.getPicture(function (photoUri) {
                CordovaExif.readData(photoUri, function (exifObject) {
                    exifData = exifObject;
                    window.resolveLocalFileSystemURL(photoUri, savePicture, onError);
                });
            }, function () {
                spa.refreshPage();
                app.hideLoader();
            }, {
                sourceType: source,
                quality: 100,
                destinationType: navigator.camera.DestinationType.FILE_URI
            });
        }

        function onError(error) {
            app.onError('Błąd zapisu zdjęcia');
        }

        function savePicture(entry) {
            endGetPosition = false;
            getLocalization();

            var d = new Date(),
                fileName = d.getTime() + ".jpeg";

            window.resolveLocalFileSystemURL(app.mainPath, function (fileSys) {
                newPicture.path = fileSys.toURL() + album.name + "/" + fileName;
                fileSys.getDirectory(album.name, { create: true, exclusive: false }, function (directory) {
                    if (newPicture.source === CAMERA)
                        entry.moveTo(directory, fileName, createThumbnails, onError);
                    else
                        entry.copyTo(directory, fileName, createThumbnails, onError);
                }, onError);
            }, onError);
        }

        function createThumbnails() {
            var image = new Image(),
                canvas = document.createElement("canvas");

            smallThumbnail(image, canvas, function () {
                largeThumbnail(image, canvas, function () {
                    getDateTime();
                });
            });
        }

        function smallThumbnail(image, canvas, callback) {
            var ctx = canvas.getContext('2d');

            canvas.width = 150;
            canvas.height = 150;

            image.onload = function () {
                var startCrop, endCrop, cropWidth, cropHeight;

                if (image.width > image.height) {
                    startCrop = (image.width - image.height) / 2;
                    endCrop = 0;
                    cropWidth = image.height;
                    cropHeight = cropWidth;
                } else {
                    startCrop = 0;
                    endCrop = (image.height - image.width) / 2;
                    cropWidth = image.width;
                    cropHeight = cropWidth;
                }

                ctx.drawImage(image,
                    startCrop, endCrop,
                    cropWidth, cropHeight,
                    0, 0,
                    150, 150);

                if (canvas.toBlob) {
                    canvas.toBlob(function (blob) {
                        var d = new Date(),
                            fileName = d.getTime() + ".jpeg";
                        newPicture.thumbnailPath = app.thumbnailsPath + "/" + fileName;
                        saveThumbnail(blob, fileName, callback);
                    }, 'image/jpeg');
                } else { onError(); }
            };
            image.src = newPicture.path;
        }

        function largeThumbnail(image, canvas, callback) {
            var ctx = canvas.getContext('2d');

            image.onload = function () {
                var ratio = image.width / image.height;

                canvas.width = 500;
                canvas.height = parseInt(500 / ratio);

                ctx.drawImage(image,
                    0, 0,
                    image.width, image.height,
                    0, 0,
                    canvas.width, canvas.height);

                if (canvas.toBlob) {
                    canvas.toBlob(function (blob) {
                        canvas = null;
                        image = null;
                        var fileName = newPicture.thumbnailPath.split('/').pop().split('.')[0] + "_1.jpeg";
                        saveThumbnail(blob, fileName, callback);
                    }, 'image/jpeg');
                } else { onError(); }
            };
            image.src = newPicture.path;
        }

        function saveThumbnail(blob, fileName, callback) {
            window.resolveLocalFileSystemURL(app.thumbnailsPath, function (fileSys) {
                fileSys.getFile(fileName, { create: true, exclusive: false }, function (fileEntry) {
                    fileEntry.createWriter(function (fileWriter) {
                        fileWriter.onwrite = callback;
                        fileWriter.onerror = onError;
                        fileWriter.write(blob);
                    });
                }, onError);
            }, onError);
        }

        function getLocalization() {
            if (newPicture.source === CAMERA)
                getCurrentLocation(); //pobranie wspolrzednych i zapisanie pogody
            else {
                if (exifData.GPSLatitude && exifData.GPSLatitude) {
                    newPicture.latitude = exifData.GPSLatitude[0] + exifData.GPSLatitude[1] / 60 + exifData.GPSLatitude[2] / 3600;
                    newPicture.longitude = exifData.GPSLongitude[0] + exifData.GPSLongitude[1] / 60 + exifData.GPSLongitude[2] / 3600;   
                }
                endGetPosition = true;
            }
        }

        function getCurrentLocation() {

            function onSuccess(position) {
                newPicture.latitude = position.coords.latitude;
                newPicture.longitude = position.coords.longitude;
                getWeatherInfo();
            }

            function onError() {
                app.onError('Nie można określić lokalizacji');
                endGetPosition = true;
            }

            navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true, timeout: 10000 });
        }

        function getWeatherInfo() {
            app.getWeather(newPicture.latitude, newPicture.longitude, onSuccess, onError);
            function onSuccess(results) {
                if (results.weather.length) {
                    var weather = {
                        temp: results.main.temp,
                        desc: results.weather[0].description,
                        icon: results.weather[0].icon
                    };

                    newPicture.weather = JSON.stringify(weather);
                    endGetPosition = true;
                }
            }

            function onError(message) {
                app.onError(message);
                endGetPosition = true;
            }
        }

        function getDateTime() {
            if (newPicture.source === CAMERA)
                newPicture.datetime = new Date();
            else {
                var datetime = exifData.DateTimeOriginal ? exifData.DateTimeOriginal : exifData.DateTime;
                newPicture.datetime = datetime.split(' ')[0].replace(/:/g, '-') + ' ' + datetime.split(' ')[1];
            }
               
            waitForPosition();
        }

        function waitForPosition() {
            if (endGetPosition)
                addPicture();
            else
                setTimeout(waitForPosition, 1000);
        }

        function addPicture() {
            app.db.executeSql('INSERT INTO picture (album_id, path, thumbnail_path, date, latitude, longitude, weather) VALUES (?,?,?,?,?,?,?)', [album.id, newPicture.path, newPicture.thumbnailPath, newPicture.datetime, newPicture.latitude, newPicture.longitude, newPicture.weather], function (rs) {
                getTags(rs.insertId);
            }, onError);
        }

        function getTags(pictureID) {

            app.addTags = function () {
                $('title').innerHTML = 'Dodaj tagi do zdjęcia';
                app.showAllTags();
                app.hideLoader();
                var form = $('addTags'); // formularz
                form.addEventListener("submit", function (e) {
                    e.preventDefault();
                    spa.clearLastURL();
                    app.showLoader();
                    var tags = $('tags').value.split(',');
                    app.addTagsToPicture(pictureID, tags, onFinish);
                }, false);


            };
            spa.route('addTags.html');
        }

        function onFinish() {
            getCamera(newPicture.source);
        }
    };

    app.editTags = function (params) {
        var pictureID = params.pictureID,
            tagInput = $('tags'),
            form = $('editTags'),
            tags = [];

        $('title').innerHTML = 'Edytuj tagi';

        app.getTagsByPictureID(pictureID, showTags);

        function showTags(tags) {
            var output = '';
            for (var i = 0; i < tags.length; i++) {
                if (i === 0) output += tags[i].name;
                else output += ',' + tags[i].name;
            }
            tagInput.value = output;
        }

        app.showAllTags();

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            tags = tagInput.value.split(',');
            editTags();
        }, false);

        function editTags() {
            app.db.executeSql('DELETE FROM tag_relationship WHERE picture_id = ?', [pictureID], function (res) {
                app.addTagsToPicture(pictureID, tags, onSuccess);
            });
        }

        function onSuccess() {
            alert('Zapisano');
            spa.route('back');
        }

    };

    app.showAllTags = function () {
        app.db.executeSql("SELECT * FROM tag", [], function (res) {
            var output = '',
                tagInput = $('tags');
            for (var i = 0; i < res.rows.length; i++) {
                var tag = document.createElement('div');
                tag.id = res.rows.item(i).name;
                tag.className = 'tag';
                tag.innerHTML = '#' + res.rows.item(i).name;
                tag.addEventListener("click", function () {
                    if (tagInput.value != '')
                        tagInput.value = tagInput.value + ', ' + this.getAttribute('id');
                    else
                        tagInput.value = this.getAttribute('id');
                    tagInput.value = tagInput.value.replace(/,,/, ',');

                }, false);
                $('allTags').appendChild(tag);
            }

            if (!res.rows.length)
                $('allTags').innerHTML = '<div class="list-info">Brak</div>';

        });


    };

    app.addTagsToPicture = function (pictureID, tags, callbackSuccess) {
        var counter = 0;
        addTag();

        function addTag() {
            counter++;
            if (counter <= tags.length) {
                var tag = tags[counter - 1];
                tag = tag.trim();
                if (tag != '')
                    addNextTag(tag);
                else
                    addTag();
            }
            else {
                callbackSuccess();
            }
        }

        function onError() {
            console.log('bład dodania tagu');
        }

        function addNextTag(tagName) {
            app.db.executeSql("SELECT id FROM tag WHERE name = ?", [tagName], function (res) {
                if (res.rows.length > 0) {
                    console.log('znaleziono ' + res.rows.item(0).id);
                    addTagToPicture(res.rows.item(0).id);
                }
                else {
                    app.db.executeSql('INSERT INTO tag (name) VALUES (?)', [tagName], function (rs) {
                        console.log('dodało nowy tag ' + rs.insertId);
                        addTagToPicture(rs.insertId);
                    }, onError);
                }

            }, onError);
        }

        function addTagToPicture(tagID) {
            app.db.executeSql("SELECT * FROM tag_relationship WHERE picture_id = ? AND tag_id = ?", [pictureID, tagID], function (res) {
                if (!res.rows.length) { // length 0
                    console.log('dodanie tagu do zdj');
                    app.db.executeSql('INSERT INTO tag_relationship (picture_id, tag_id) VALUES (?,?)', [pictureID, tagID], function (rs) {
                        addTag();
                    }, onError);
                }
                else {
                    console.log('znaleziono juz tag z tym zdjeciem');
                    addTag();
                }

            }, onError);
        }

    };

    app.getTagsByPictureID = function (pictureID, callback) {
        app.db.executeSql("SELECT * FROM tag as t INNER JOIN tag_relationship as tr ON t.id = tr.tag_id WHERE tr.picture_id = ?", [pictureID], function (res) {
            var tags = [];
            for (var i = 0; i < res.rows.length; i++) {
                tags.push({
                    id: res.rows.item(i).id,
                    name: res.rows.item(i).name
                });
            }
            callback(tags);
        });
    };

    app.getWeather = function (latitude, longitude, successCallback, errorCallback) {

        if (app.isOnline) {
            var url = "http://api.openweathermap.org/data/2.5/weather?lat=" + latitude + "&units=metric&lon=" + longitude + "&units=metric&lang=pl&appid=1671d684d673b7279571dfba6d8127e9";

            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'json';
            xhr.onload = function () {
                var status = xhr.status;
                if (status === 200) {
                    successCallback(xhr.response);
                } else {
                    errorCallback("Nie zapisano pogody");
                }
            };
            xhr.send();
        }
        else {
            errorCallback('Nie zapisano pogody. Brak połączenia z internetem');
        }


    };

    app.photo = function (params) {
        var picture = {},
            previousPicture = 0,
            nextPicture = 0;

        $('title').innerHTML = 'Zdjęcie';
        app.showLoader();
        setTimeout(app.hideLoader, 500);


        for (var i = 0; i < app.pictureList.length; i++) {
            if (app.pictureList[i].id == params.id) {
                picture = app.pictureList[i];
                if (i > 0 && i < app.pictureList.length - 1) {
                    previousPicture = i - 1;
                    nextPicture = i + 1;
                } 
                else if (i === 0 ) {
                    if(app.pictureList.length > 1) {
                        previousPicture = app.pictureList.length - 1;
                        nextPicture = i + 1;
                    }
                    else {
                        previousPicture = 0;
                        nextPicture = 0;
                    }
                }
                else if (i === app.pictureList.length - 1) {
                    previousPicture = i-1;
                    nextPicture = 0;
                }
                
                init();
            }
        }

        function init() {
            initControl();
            setTimeout(function () {
                $('photo').src = picture.thumbnail_path.slice(0, -5) + '_1.jpeg';
                //$('photo').onload = app.hideLoader;
            }, 10);

            try {
                var weather = JSON.parse(picture.weather);
                $('weatherIcon').src = 'images/weather_icon/' + weather.icon + '.png';            
                $('weatherDesc').innerText = weather.desc;
                $('weatherTemp').innerText = Number(weather.temp).toFixed(0);
            }
            catch (e) {
                $('weatherInfo').style.display = 'none';
            }

            var mapLink = $('showOnMap');
            var photoLoc = $('photoLoc');

            if (picture.latitude && picture.longitude) {
                mapLink.setAttribute('href', 'map.html?lat=' + picture.latitude + '&lng=' + picture.longitude + '&img=' + picture.thumbnail_path);
                photoLoc.innerText = '' + Number(picture.latitude).toFixed(2) + ' ' + Number(picture.longitude).toFixed(2);
            }
            else {
                mapLink.style.display = 'none';
                photoLoc.innerText = 'Nie zapisano';
            }

            $('delete').addEventListener("click", removePicture, false);

            $('photoDate').innerText = showDate(picture.date);

            $('editTags').setAttribute('href', 'editTags.html?pictureID=' + picture.id);

            app.getTagsByPictureID(picture.id, showTagsToPicture);
        }

        function initControl() {
            $('prev').addEventListener('click', function () {
                getNextPicture('left');
            }, false);
            $('next').addEventListener('click', function () {
                getNextPicture('right');
            }, false);
            $('photo').addEventListener('click', function () {
                viewPicture();
            }, false);
        }

        function getNextPicture(dir) {
            app.showLoader();
            spa.history.pop();
            if (dir === 'left') {
                spa.route('photo.html?id=' + app.pictureList[previousPicture].id);
            } else {
                spa.route('photo.html?id=' + app.pictureList[nextPicture].id);
            }
        }

        function viewPicture() {
            var pinchZoom;
            $('popoverContent').innerHTML = '' +
                '<canvas id="photoView" style="width: 100%; height: 100%"></canvas>';

            $('popover').style.display = 'block';
            pinchZoom = new PinchZoomCanvas({
                canvas: $('photoView'),
                path: picture.path,
                doubletap: false
            });

            $('closePopover').addEventListener('click', function close() {
                pinchZoom.destroy();
                $('popover').style.display = 'none';
                this.removeEventListener('click', close);
            }, false);
        }

        function showDate(photoDate) {
            function leadingZero(i) {
                return (i < 10) ? '0' + i : i;
            }
            var date = new Date(photoDate);
            var textDate = leadingZero(date.getDate()) + "." + leadingZero((date.getMonth() + 1)) + "." + date.getFullYear() + 
                   ' ' + date.getHours() + ":" + leadingZero(date.getMinutes()) + ":" + leadingZero(date.getSeconds());

            return textDate;
        }

        function showTagsToPicture(tags) {
            var output = '';
            for (var i = 0; i < tags.length; i++) {
                output += '<a href="tag.html?id=' + tags[i].id +
                    '">#' + tags[i].name + '</a>';
            }

            if (tags.length)
                $('photoTags').innerHTML = output;
            else
                $('photoTags').innerHTML = '<div class="list-info">Brak</div>';
        }

        function removePicture() {
            var result = confirm('Czy chcesz usunąc to zdjęcie?');
            if (result) {
                app.db.transaction(function (tx) {
                    tx.executeSql('DELETE FROM tag_relationship WHERE picture_id = ?', [picture.id]);
                    tx.executeSql('DELETE FROM picture WHERE id = ?', [picture.id]);
                }, function (error) {
                    app.onError('Nie mażna usunąć zdjęcia');
                }, function () {
                    alert('Usunięto');
                    spa.route('back');
                });
            }
        }
    };

    app.tag = function (params) {
        var tag;

        app.db.executeSql("SELECT * FROM tag WHERE id = ?", [params.id], function (res) {
            if (res.rows.length)
                tagPageInit(res.rows.item(0));
            else
                app.onError('Nie znaleziono tagu');
        });

        function tagPageInit(row) {
            tag = row;
            $('title').innerHTML = 'Tag: ' + tag.name;

            app.db.executeSql("SELECT p.* FROM picture as p INNER JOIN tag_relationship as tr ON p.id = tr.picture_id WHERE tr.tag_id = ? ORDER BY p.id DESC", [tag.id], function (res) {
                var output = '';
                app.pictureList = [];
                for (var i = 0; i < res.rows.length; i++) {
                    output += '<a href="photo.html?id=' + res.rows.item(i).id +
                        '"><img src="' + res.rows.item(i).thumbnail_path + '" /></a>';
                    app.pictureList.push(res.rows.item(i));
                }

                if (res.rows.length)
                    $('photoList').innerHTML = output;
                else
                    $('photoList').innerHTML = '<div class="list-info">Brak</div>';

                $('photoCount').innerText = res.rows.length;
            });

        }


    };

    app.search = function () {
        $('title').innerHTML = 'Szukaj zdjęć';
        app.db.executeSql("SELECT * FROM tag", [], function (res) {
            var output = '';
            for (var i = 0; i < res.rows.length; i++) {
                output += '<a href="tag.html?id=' + res.rows.item(i).id +
                    '">#' + res.rows.item(i).name + '</a>';
            }

            if (res.rows.length)
                $('photoTags').innerHTML = output;
            else
                $('photoTags').innerHTML = '<div class="list-info">Brak</div>';

        });
    };

    app.albumMap = function (params) {
        var pictures = [];
        $('title').innerHTML = 'Zdjęcia na mapie';

        app.loadMapScript(function () {
            app.db.executeSql("SELECT * FROM picture WHERE album_id = ? AND latitude != '' ORDER BY id DESC", [params.id], function (res) {
                for (var i = 0; i < res.rows.length; i++) {
                    if (res.rows.item(i).latitude && res.rows.item(i).longitude)
                        pictures.push(res.rows.item(i));
                }
                showOnMap();
            });
        }, app.onError);

        function showOnMap() {
            var markers = [];
            var mapOptions = {
                center: new google.maps.LatLng(0, 0),
                zoom: 1,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };

            var map = new google.maps.Map($("map_canvas"), mapOptions);

            var icon = {
                url: "",
                scaledSize: new google.maps.Size(75, 75),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(0, 0)
            };

            for (var i = 0; i < pictures.length; i++) {
               
                var latLong = new google.maps.LatLng(pictures[i].latitude, pictures[i].longitude);
                icon.url = pictures[i].thumbnail_path;
                var marker = new google.maps.Marker({
                    position: latLong,
                    icon: icon
                });
                markers.push(marker);

                setMarkerListener(marker, i);  
                
            }

            map.setCenter(markers[0].getPosition());
           
            var markerCluster = new MarkerClusterer(map, markers, { imagePath: 'images/m', maxZoom: 17 });

            map.setZoom(15);
        }

        function setMarkerListener(marker, i) {
            var pinchZoom;
            google.maps.event.addListener(marker, 'click', function () {

                $('popover').style.display = 'block';

                $('popoverContent').innerHTML = '' +
                    '<canvas id="photoView" style="width: 100%; height: 100%"></canvas>';

                pinchZoom = new PinchZoomCanvas({
                    canvas: $('photoView'),
                    path: pictures[i].path,
                    momentum: false,
                    doubletap: false
                });

                $('closePopover').addEventListener('click', function close() {
                    pinchZoom.destroy();
                    $('popover').style.display = 'none';
                    this.removeEventListener('click', close);
                }, false);
            });
        }

    };

    app.map = function (params) {
        $('title').innerHTML = 'Lokalizacja zdjęcia';

        app.loadMapScript(function () {
            var latitude = params.lat;
            var longitude = params.lng;

            var mapOptions = {
                center: new google.maps.LatLng(latitude, longitude),
                zoom: 1,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            var map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);

            var latLong = new google.maps.LatLng(latitude, longitude);
            var marker = new google.maps.Marker({
                position: latLong
            });

            var infowindow = new google.maps.InfoWindow({
                content: "<div><img width='100' src='" + params.img + "'/></div>"
            });
            setTimeout(function () { infowindow.open(map, marker); }, 500);

            marker.setMap(map);
            map.setZoom(14);
            map.setCenter(marker.getPosition());
        }, app.onError);   
    };

    app.loadMapScript = function (successCallback, errorCallback) {
        if (!app.isMapScriptLoaded) {
            if (app.isOnline) {
                var script = document.createElement("script");
                script.type = "text/javascript";

                script.onload = function () {
                    app.isMapScriptLoaded = true;
                    successCallback();
                };
                script.onerror = function () {
                    errorCallback('Nie można załadować skryptu');
                };
                script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCH3VCLkbc0Bcjmsw2bWxF3hjvHdDrg-Fg';
                document.head.appendChild(script);
            }
            else {
                errorCallback('Brak połączenia z internetem');
            }
        }
        else {
            successCallback();
        }
    };

    app.onError = function (message) {
        console.log(message);
        alert(message);
    };

    app.showLoader = function () {
        $('wait').style.display = 'flex';
    };

    app.hideLoader = function () {
        $('wait').style.display = 'none';
    };

    //
    // SPA
    //
    spa.init = function () { // przechwycenie zdarzenia kliknięcia w link
        document.body.onclick = function (e) { // click event dla każego elementu strony
            e = e || window.event;
            var link = findLink(e.target || e.srcElement);
            if (link && link.getAttribute('href').indexOf('#') == -1) { // jeśli element jest linkiem i nie jest kotwicą (#)
                spa.route(link.getAttribute('href'));
                return false;
            }
        };
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
        url = spa.saveURL(url);
        url = spa.getParameters(url);
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
            for (var i = 0; i < query.length; i++) {
                var param = query[i].split('=');
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

    spa.refreshPage = function () {
        var url = spa.history[spa.history.length - 1];
        spa.history.pop();
        spa.route(url);
    };

    spa.clearLastURL = function () {
        spa.history.pop();
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

})();