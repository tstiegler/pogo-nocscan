window.fe = (function() {
    var pokeTable = ["", "Bulbasaur","Ivysaur","Venusaur","Charmander","Charmeleon","Charizard","Squirtle","Wartortle","Blastoise","Caterpie","Metapod","Butterfree","Weedle","Kakuna","Beedrill","Pidgey","Pidgeotto","Pidgeot","Rattata","Raticate","Spearow","Fearow","Ekans","Arbok","Pikachu","Raichu","Sandshrew","Sandslash","Nidoran♀","Nidorina","Nidoqueen","Nidoran♂","Nidorino","Nidoking","Clefairy","Clefable","Vulpix","Ninetales","Jigglypuff","Wigglytuff","Zubat","Golbat","Oddish","Gloom","Vileplume","Paras","Parasect","Venonat","Venomoth","Diglett","Dugtrio","Meowth","Persian","Psyduck","Golduck","Mankey","Primeape","Growlithe","Arcanine","Poliwag","Poliwhirl","Poliwrath","Abra","Kadabra","Alakazam","Machop","Machoke","Machamp","Bellsprout","Weepinbell","Victreebel","Tentacool","Tentacruel","Geodude","Graveler","Golem","Ponyta","Rapidash","Slowpoke","Slowbro","Magnemite","Magneton","Farfetch’d","Doduo","Dodrio","Seel","Dewgong","Grimer","Muk","Shellder","Cloyster","Gastly","Haunter","Gengar","Onix","Drowzee","Hypno","Krabby","Kingler","Voltorb","Electrode","Exeggcute","Exeggutor","Cubone","Marowak","Hitmonlee","Hitmonchan","Lickitung","Koffing","Weezing","Rhyhorn","Rhydon","Chansey","Tangela","Kangaskhan","Horsea","Seadra","Goldeen","Seaking","Staryu","Starmie","Mr. Mime","Scyther","Jynx","Electabuzz","Magmar","Pinsir","Tauros","Magikarp","Gyarados","Lapras","Ditto","Eevee","Vaporeon","Jolteon","Flareon","Porygon","Omanyte","Omastar","Kabuto","Kabutops","Aerodactyl","Snorlax","Articuno","Zapdos","Moltres","Dratini","Dragonair","Dragonite","Mewtwo","Mew"];

    var scanners = ko.observableArray([]);
    var currentAccount = ko.observable();
    var displayedCell = ko.observable();

    var scannerInstances = { };

    var allCatchable = ko.observableArray([]);
    var allNearby = ko.observableArray([]);

    var map;    
    var displayedCellPoly;
    var activeAccountMarker;

    var showTimeout;

    window.setInterval(getScanners, 10000);
    getScanners();

    function getScanners() {
        $.getJSON("http://127.0.0.1:3000/scanners", function(data) {
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

            if(currentAccount() == null)
                showAccount(data[0]);
        });
    }

    function scannerInstance(name) {
        var nearbyCircle;
        var catchableCircle;

        var pollInterval = window.setInterval(poll, 10000);
        poll();

        function poll() {
            $.getJSON("http://127.0.0.1:3000/mapobjects/" + name, handleMapObjects);
            $.getJSON("http://127.0.0.1:3000/position/" + name, handlePosition);
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

        function handlePosition(data) {
            if(map != null && data != null) {
                if(name == currentAccount()) {
                    map.setCenter(data);

                    if(activeAccountMarker == null) {
                        activeAccountMarker = new google.maps.Marker({
                            position: data,
                            map: map,
                            zIndex: 4
                        });
                    } else {
                        activeAccountMarker.setPosition(data);
                    }
                }

                if(nearbyCircle != null) 
                    nearbyCircle.setCenter(data);
                else {
                    nearbyCircle = new google.maps.Circle({
                        strokeColor: '#00FF00',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#00FF00',
                        fillOpacity: 0.35,
                        map: map,
                        center: data,
                        radius: 200,
                        zIndex: 1
                    });
                }

                if(catchableCircle != null)
                    catchableCircle.setCenter(data);
                else {        
                    catchableCircle = new google.maps.Circle({
                        strokeColor: '#0000FF',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#0000FF',
                        fillOpacity: 0.35,
                        map: map,
                        center: data,
                        radius: 70,
                        zIndex: 2
                    });
                }
            }
        }

        function kill() {
            window.clearInterval(pollInterval);
            if(nearbyCircle != null) nearbyCircle.setMap(null);
            if(catchableCircle != null) catchableCircle.setMap(null);
        }        

        return {
            poll: poll,
            kill: kill,        
            nearbyCircle: nearbyCircle,
            catchableCircle: catchableCircle
        }
    }

    function showAccount(account) {
        currentAccount(account);
        scannerInstances[currentAccount()].poll();
    }

    function clearAll() {
        currentAccount(null);
        allCatchable([]);
        allNearby([]);
    }
    
    function initMap() {
        map = new google.maps.Map(document.getElementById('map'), {
          zoom: 17,
          center: {lat: 0, lng: 0}
        });
    }

    function showMenu(id) {
        $('.popout-menu').slideUp();

        if($('#' + id).is(':visible'))
            $('#' + id).slideUp();
        else
            $('#' + id).slideDown();
    }

    function highlightCell(cellId) {
        if(displayedCell() == cellId)
            return;
        
        displayedCell(cellId);

        var key = S2.S2Cell.idToKey(cellId);
        var corners = S2.S2Cell.FromHilbertQuadKey(key).getCornerLatLngs();

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

    return {
        pokeTable: pokeTable,

        showAccount: showAccount,
        showMenu: showMenu,
        initMap: initMap,
        highlightCell: highlightCell,

        scanners: scanners,                
        allNearby: allNearby,
        allCatchable: allCatchable
    };
})();


ko.applyBindings(window.fe);