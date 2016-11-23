window.fe = (function() {
    // Vars.

    var pokeTable = ["", "Bulbasaur","Ivysaur","Venusaur","Charmander","Charmeleon","Charizard","Squirtle","Wartortle","Blastoise","Caterpie","Metapod","Butterfree","Weedle","Kakuna","Beedrill","Pidgey","Pidgeotto","Pidgeot","Rattata","Raticate","Spearow","Fearow","Ekans","Arbok","Pikachu","Raichu","Sandshrew","Sandslash","Nidoran♀","Nidorina","Nidoqueen","Nidoran♂","Nidorino","Nidoking","Clefairy","Clefable","Vulpix","Ninetales","Jigglypuff","Wigglytuff","Zubat","Golbat","Oddish","Gloom","Vileplume","Paras","Parasect","Venonat","Venomoth","Diglett","Dugtrio","Meowth","Persian","Psyduck","Golduck","Mankey","Primeape","Growlithe","Arcanine","Poliwag","Poliwhirl","Poliwrath","Abra","Kadabra","Alakazam","Machop","Machoke","Machamp","Bellsprout","Weepinbell","Victreebel","Tentacool","Tentacruel","Geodude","Graveler","Golem","Ponyta","Rapidash","Slowpoke","Slowbro","Magnemite","Magneton","Farfetch’d","Doduo","Dodrio","Seel","Dewgong","Grimer","Muk","Shellder","Cloyster","Gastly","Haunter","Gengar","Onix","Drowzee","Hypno","Krabby","Kingler","Voltorb","Electrode","Exeggcute","Exeggutor","Cubone","Marowak","Hitmonlee","Hitmonchan","Lickitung","Koffing","Weezing","Rhyhorn","Rhydon","Chansey","Tangela","Kangaskhan","Horsea","Seadra","Goldeen","Seaking","Staryu","Starmie","Mr. Mime","Scyther","Jynx","Electabuzz","Magmar","Pinsir","Tauros","Magikarp","Gyarados","Lapras","Ditto","Eevee","Vaporeon","Jolteon","Flareon","Porygon","Omanyte","Omastar","Kabuto","Kabutops","Aerodactyl","Snorlax","Articuno","Zapdos","Moltres","Dratini","Dragonair","Dragonite","Mewtwo","Mew"];

    var c = {
        UI_MODE_SHOW_ACCOUNTS: 0,
        UI_MODE_ENCOUNTERS_ONLY: 1
    }

    var scannerInstances = {};
    var encounterMarkers = {};

    var map;    
    var displayedCellPoly;
    var activeAccountMarker;

    var showTimeout;

    // Observables.   

    var uiMode = ko.observable(c.UI_MODE_ENCOUNTERS_ONLY);
    var scanners = ko.observableArray([]);
    var currentAccount = ko.observable();
    var displayedCell = ko.observable();    

    var isMobile = ko.observable(false);
    var infoWindowShown = ko.observable(false);

    var allCatchable = ko.observableArray([]);
    var allNearby = ko.observableArray([]);

    var captchas = ko.observableArray([]);
    var captchaUrl = ko.observable();
    var captchaUsername = ko.observable();
    var captchaToken = ko.observable();

    // Computeds.

    var ecDummy = ko.observable();
    var encounterCount = ko.computed(function() {
        console.log(ecDummy());

        var result = 0;
        _.forOwn(encounterMarkers, function(value, id) { result++; });
        return result;
    })

    // Functions.

    function initUI() {
        $.getJSON("/uiconfig", function(uiconfig) {
            uiMode(uiconfig.mode);
            if(uiconfig.mode == c.UI_MODE_SHOW_ACCOUNTS) {
                window.setInterval(getScanners, 10000);
                getScanners();
            }

            window.setInterval(pollAll, 10000);
            pollAll();

            map.setCenter(uiconfig.initialCenter);

            window.setTimeout(function() {
                $(document).ready(function(){
                    $('.tooltipped').tooltip({delay: 50});
                });
            }, 1000)

            $('.modal').modal();
        });

        $(window).resize(_.throttle(handleResize, 100));
        handleResize();
    }

    function handleResize() {
        var h = $(window).height();
        var w = $(window).width();

        $(".info-window .card").css({
            height: (h - 65) + "px"
        });

        if(w < 1024) {
            isMobile(true);

            if(!infoWindowShown()) {
                $(".info-window").css({
                    left: "-250px"
                });
            }
        } else {
            isMobile(false);
            $(".info-window").css({ left: 5 });
        }      
    }

    function getScanners() {
        $.getJSON("/scanners", function(data) {
            scanners(data);

            // Create scanner instances for those that don't exist.
            _.each(data, function(scannerName) {
                if(!(scannerName in scannerInstances))
                    scannerInstances[scannerName] = scannerInstance(scannerName);
            });

            // Kill those that don't exist anymore.
            _.forOwn(scannerInstances, function(instance, scannerName) {
                if(_.find(data, function(item) { return item == scannerName; }) == null) {
                    instance.kill();
                    delete scannerInstances[scannerName];
                }
            });

            if(currentAccount() == null || !(currentAccount() in scannerInstances))
                showAccount(data[0]);
        });
    }

    function pollAll() {
        $.getJSON("/allencounters", function(data) {
            _.forOwn(data, function(value, id) {
                createEncounterMarker(value.encounter, value.secondsleft);
            });
        });

        $.getJSON("/captchas", function(data) {
            captchas([]);
            _.forOwn(data, function(value, id) {
                captchas.push({
                    username: id,
                    url: value.url,
                    token: value.token 
                });
            });
        });      
    }

    function createEncounterMarker(encounter, secondsleft) {        
        // Check if we have already created a marker for this encounter.
        if(encounter.encounter_id in encounterMarkers)
            return;            

        ecDummy((new Date()).getTime()); // Trigger encounter count computed.

        // Create the encounter marker.
        console.log("Placing marker: " +  encounter.encounter_id + " (will last " + secondsleft + " seconds)");
        encounterMarkers[encounter.encounter_id] = new PokeMarker(
            new google.maps.LatLng(encounter.latitude, encounter.longitude), 
            map,
            {
                id: encounter.pokemon_id
            }
        );

        // Set the marker to be removed after the secondsleft.
        setTimeout(function() {
            console.log("Removing marker:", encounter.encounter_id);

            encounterMarkers[encounter.encounter_id].remove();
            encounterMarkers[encounter.encounter_id].setMap(null);            
            delete encounterMarkers[encounter.encounter_id];

            ecDummy((new Date()).getTime()); // Trigger encounter count computed.
        }, secondsleft * 1000);
    }

    function scannerInstance(name) {
        var nearbyCircle;
        var catchableCircle;
        var position;
        var huntWorkerCircles = [];
        var updateCircles = false;

        var pollInterval = window.setInterval(poll, 10000);
        poll();

        function poll() {
            $.getJSON("/mapobjects/" + name, handleMapObjects);
            $.getJSON("/encounters/" + name, handleEncounters);
            $.getJSON("/position/" + name, handlePosition);
        }

        function handleMapObjects(mapObjects) {
            var tmpNearby = [];
            var tmpCatchable = [];            

            if(mapObjects != null && map != null) {
                _.each(mapObjects.map_cells, function(cell, idx) {                
                    _.each(cell.catchable_pokemons, function(item) {
                        item.s2_cell_id = cell.s2_cell_id; 
                        tmpCatchable.push(item);
                    });
                    _.each(cell.nearby_pokemons, function(item) { 
                        item.s2_cell_id = cell.s2_cell_id; 
                        tmpNearby.push(item); 
                    });
                });
            }
        
            if(name == currentAccount()) {
                allNearby(tmpNearby);
                allCatchable(tmpCatchable);
            }
        }

        function handleEncounters(data) {
            _.forOwn(data, function(value, id) {
                createEncounterMarker(value.encounter, value.secondsleft);
            });
        }

        function handlePosition(data) {
            if(map != null && data != null) {
                position = data;

                if(nearbyCircle != null && !updateCircles) 
                    nearbyCircle.setCenter({lat: data.lat, lng: data.lng});
                else {
                    if(nearbyCircle != null)  nearbyCircle.setMap(null);

                    nearbyCircle = new google.maps.Circle({
                        strokeColor: '#00FF00',
                        strokeOpacity: 0.2,
                        strokeWeight: 2,
                        fillColor: '#00FF00',
                        fillOpacity: (name == currentAccount()) ? 0.2 : 0.1,
                        map: map,
                        center: {lat: data.lat, lng: data.lng},
                        radius: 200,
                        zIndex: 1
                    });
                }

                if(catchableCircle != null && !updateCircles)
                    catchableCircle.setCenter({lat: data.lat, lng: data.lng});
                else {        
                    if(catchableCircle != null) catchableCircle.setMap(null);

                    catchableCircle = new google.maps.Circle({
                        strokeColor: '#0000FF',
                        strokeOpacity: 0.1,
                        strokeWeight: 2,
                        fillColor: '#0000FF',
                        fillOpacity: (name == currentAccount()) ? 0.2 : 0.1,
                        map: map,
                        center: {lat: data.lat, lng: data.lng},
                        radius: 70,
                        zIndex: 2
                    });                    
                }

                if(updateCircles)
                    updateCircles = false;

                _.each(huntWorkerCircles, function(item) {
                    item.setMap(null);
                })
                huntWorkerCircles = [];

                if("huntWorkers" in data) {
                    _.each(data.huntWorkers, function(workerPos) {
                        huntWorkerCircles.push(new google.maps.Circle({
                            strokeColor: '#FFFF00',
                            strokeOpacity: 0.1,
                            strokeWeight: 2,
                            fillColor: '#FFFF00',
                            fillOpacity: 0.2,
                            map: map,
                            center: workerPos,
                            radius: 70,
                            zIndex: 2
                        }));
                    })
                }
            }1
        }

        function kill() {
            window.clearInterval(pollInterval);
            if(nearbyCircle != null) nearbyCircle.setMap(null);
            if(catchableCircle != null) catchableCircle.setMap(null);
        }        

        return {
            poll: poll,
            kill: kill,        
            getPosition: function() { return position; },
            updateCircles: function() { updateCircles = true; },
            nearbyCircle: nearbyCircle,
            catchableCircle: catchableCircle            
        }
    }

    function showAccount(account) {
        currentAccount(account);

        _.forOwn(scannerInstances, function(value, key) {
            scannerInstances[key].updateCircles();
            scannerInstances[key].poll();
        });        
    }

    function clearAll() {
        currentAccount(null);
        allCatchable([]);
        allNearby([]);
    }

    function centerMap() {
        if (location.protocol != 'https:') {
            Materialize.toast("pogo-nocscan must be set up to use https to be able to get browser location.", 4000);
            return;
        }

        navigator.geolocation.getCurrentPosition(function(pos) {
            map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });        
    }
    
    google.maps.event.addDomListener(window, 'load', initMap);
    function initMap() {
        console.log("Initializing map...");

        map = new google.maps.Map(document.getElementById('map'), {
          zoom: 17,
          center: {lat: 0, lng: 0},
          disableDefaultUI: true,
          styles: [{"elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"landscape","stylers":[{"visibility":"on"}]},{"featureType":"road","stylers":[{"visibility":"on"}]},{"featureType":"water","stylers":[{"visibility":"on"}]}]
        });

        initUI();
    }

    function showInfoWindow() {
        if(!infoWindowShown()) {
            $(".info-window").animate({
                'left': 5 + "px" 
            });
            infoWindowShown(true);
        }
    }

    function closeInfoWindow() {
        if(infoWindowShown() && isMobile()) {
            $(".info-window").animate({
                'left': -250 + "px"
            });
            infoWindowShown(false);
        }
    }

    function showMenu(id) {
        $('.popout-menu').slideUp();

        if($('#' + id).is(':visible'))
            $('#' + id).slideUp();
        else
            $('#' + id).slideDown();
    }

    function openCaptchas() {
        if($("#captchas").is(':visible'))
            $("#captchas").slideUp();
        else
            $("#captchas").slideDown();            
    }

    function showCaptchaModal(username, url) {
        captchaUrl(url);
        captchaUsername(username);
        captchaToken('');
        $('#captcha-modal').modal('open');
        $("#captchas").slideUp();
    }    

    function captchaSend() {
        if(captchaToken() == "") {
            alert("Please enter a valid token.");
            return;
        }

        $.post("/captcharesult", {username: captchaUsername(), token: captchaToken()}, function(data) {
            captchaUrl('');
            captchaUsername('');
            captchaToken('');

            if(data == "OK")
                Materialize.toast('Captcha token sent, waiting for result.', 4000);
            else 
                Materialize.toast('Something went wrong sending captcha.', 4000);
        })
        
        $('#captcha-modal').modal('close');
    }

    function highlightCell(cellId) {
        if(displayedCell() == cellId)
            return;
        
        displayedCell(cellId);


        var key = S2.S2Cell.idToKey(cellId);
        var corners = S2.S2Cell.FromHilbertQuadKey(key).getCornerLatLngs();

        map.setCenter(corners[0]);

        if(displayedCellPoly != null)
            displayedCellPoly.setMap(null);
        
        displayedCellPoly = new google.maps.Polygon({
          paths: corners,
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#FF0000',
          fillOpacity: 0.35,
          zIndex: 3
        });
        displayedCellPoly.setMap(map);
    }

    /**
     * START CUSTOM MARKER
     * ------------------------------------------------------------------------
     */
    var cMarkerId = 0;
    function PokeMarker(latlng, map, args) {
        this.latlng = latlng;	
        this.args = args;	
        this.setMap(map);	

        cMarkerId++;
        this.markerId = cMarkerId;
    }

    PokeMarker.prototype = new google.maps.OverlayView();

    PokeMarker.prototype.draw = function() {
        
        var self = this;
        
        var div = this.div;
        
        if (!div) {
        
            div = this.div = document.createElement('div');
            
            div.className = 'marker';
            
            div.style.position = 'absolute';
            div.style.cursor = 'pointer';
            div.style.width = '40px';
            div.style.height = '40px';
            div.style.background = 'rgba(0, 0, 0, 0.1)';
            div.style['background-image'] = "url(/frontend/img/pokemon/" + self.args.id + ".png)";
            div.style['background-repeat'] = "no-repeat";
            div.style['background-size'] = "contain";
            div.style['background-position'] = "center center";
            div.style['border-radius'] = "40px";
            div.style['border'] = "7px solid rgba(0, 0, 0, 0.0)";
            div.style['z-index'] = "5";

            div.innerHTML = "<div class='marker-notch'></div>"

            div.id = "mrk-" + self.markerId;
            
            google.maps.event.addDomListener(div, "click", function(event) {			
                google.maps.event.trigger(self, "click");
            });
            
            var panes = this.getPanes();
            panes.overlayImage.appendChild(div);
        }
        
        var point = this.getProjection().fromLatLngToDivPixel(this.latlng);
        
        if (point) {
            div.style.left = (point.x - 20) + 'px';
            div.style.top = (point.y - 50) + 'px';
        }
    };

    PokeMarker.prototype.remove = function() {
        if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
        }	
    };

    PokeMarker.prototype.getPosition = function() {
        return this.latlng;	
    };


    return {
        // Vars
        c: c,
        pokeTable: pokeTable,
        scannerInstances: scannerInstances,
        
         // Observables.
        uiMode: uiMode,
        isMobile: isMobile,
        infoWindowShown: infoWindowShown,        
        scanners: scanners,                
        allNearby: allNearby,
        allCatchable: allCatchable,
        currentAccount: currentAccount,
        captchas: captchas,
        captchaUrl: captchaUrl,
        captchaUsername: captchaUsername,
        captchaToken: captchaToken,

        // Computeds
        encounterCount: encounterCount,

        // Functions.
        showAccount: showAccount,
        showMenu: showMenu,
        showInfoWindow: showInfoWindow,
        closeInfoWindow: closeInfoWindow,
        openCaptchas: openCaptchas,
        showCaptchaModal: showCaptchaModal,
        captchaSend: captchaSend,

        initMap: initMap,
        highlightCell: highlightCell,
        centerMap: centerMap
    };
})();


ko.applyBindings(window.fe);