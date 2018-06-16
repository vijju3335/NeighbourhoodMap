// declaring global variables
var map;
var infoWindow;
var bounds;

// google maps init
function initMap() {
    //Constructor creates a new map - only center and zoom are required.
    map = new google.maps.Map(document.getElementById('map'), {
        center: {
            lat: 27.4805119,
            lng: 79.9669832
        },
        zoom: 13
    });
    infoWindow = new google.maps.InfoWindow();

    bounds = new google.maps.LatLngBounds();

    ko.applyBindings(new ViewModel());
}

// handle map error
function GoogleApiError() {
    alert('Error Occured While Loading googleMapApi');
}
/* Location Model Controlling*/
var Markers = function(locationsData) {
    var self = this;

    this.title = locationsData.title;
    this.position = locationsData.location;
    this.street = '',
        this.city = '',
        this.country = '';

    this.visible = ko.observable(true);

    // Style the markers a bit. This will be our listing marker icon.
    var defaultIcon = makeMarkerIcon('0091ff');
    // Create a "highlighted location" marker color for when the user
    // mouses over the marker.
    var highlightedIcon = makeMarkerIcon('FFFF24');
    // access tokens from foursquare api 
    var clientID = 'FYGYPC2SFYROPJRJPYQIMWRXLVRXDBG5UPBP1ZTTXO2XMOKR';
    var clientSecret = '34YBK0ENB2XJM3G4Z4ZVHJZKVU2HKREF1TF3ZN42EXFCZEW0';

    var URL = 'https://api.foursquare.com/v2/venues/search?ll=' + this.position.lat + ',' + this.position.lng + '&client_id=' + clientID + '&client_secret=' + clientSecret + '&v=20180605' + '&query=' + this.title;

    $.getJSON(URL).done(function(locationsData) {
        var results = locationsData.response.venues[0];
        self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0] : 'N/A';
        self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1] : 'N/A';
        self.country = results.location.country ? results.location.country : 'N/A';
    }).fail(function() {
        alert('Something went wrong with foursquare');
    });

    // Create a marker per location, and put into markers array
    this.marker = new google.maps.Marker({
        position: this.position,
        title: this.title,
        animation: google.maps.Animation.DROP,
        icon: defaultIcon
    });

    self.filterMarkers = ko.computed(function() {
        // set marker and extend bounds (showListings)
        if (self.visible() === true) {
            self.marker.setMap(map);
            bounds.extend(self.marker.position);
            map.fitBounds(bounds);
        } else {
            self.marker.setMap(null);
        }
    });

    // Create an onclick even to open an indowindow at each marker
    this.marker.addListener('click', function() {
        populateInfoWindow(this, self.street, self.city, self.country, infoWindow);
        toggleBounce(this);
        map.panTo(this.getPosition());
    });

    // Two event listeners - one for mouseover, one for mouseout,
    // to change the colors back and forth.
    this.marker.addListener('mouseover', function() {
        this.setIcon(highlightedIcon);
    });
    this.marker.addListener('mouseout', function() {
        this.setIcon(defaultIcon);
    });

    // show item info when selected from list
    this.showLocation = function(location) {
        google.maps.event.trigger(self.marker, 'click');
    };

    // creates bounce effect when item selected
    this.bounce = function(place) {
        google.maps.event.trigger(self.marker, 'click');
    };

};

/* View Model */
var ViewModel = function() {
    var self = this;

    this.searchLoc = ko.observable('');

    this.mapList = ko.observableArray([]);

    // add location markers for each location
    locations.forEach(function(location) {
        self.mapList.push(new Markers(location));
    });

    // locations viewed on map
    this.locationList = ko.computed(function() {
        var filterLocations = self.searchLoc().toLowerCase();
        if (filterLocations) {
            return ko.utils.arrayFilter(self.mapList(), function(location) {
                var str = location.title.toLowerCase();
                var result = str.includes(filterLocations);
                location.visible(result);
                return result;
            });
        }
        self.mapList().forEach(function(location) {
            location.visible(true);
        });
        return self.mapList();
    }, self);
};

// This function populates the infowindow when the marker is clicked. We'll only allow
// one infowindow which will open at the marker that is clicked, and populate based
// on that markers position.
function populateInfoWindow(marker, street, city, country, infowindow) {
    // Check to make sure the infowindow is not already opened on this marker.
    if (infowindow.marker != marker) {
        // Clear the infowindow content to give the streetview time to load.
        infowindow.setContent('');
        infowindow.marker = marker;

        // Make sure the marker property is cleared if the infowindow is closed.
        infowindow.addListener('closeclick', function() {
            infowindow.marker = null;
        });
        var streetViewService = new google.maps.StreetViewService();
        var radius = 50;

        var windowContent = '<h4>' + marker.title + '</h4>' +
            '<p>' + street + "<br>" + city + '<br>' + country + "</p>";

        // In case the status is OK, which means the pano was found, compute the
        // position of the streetview image, then calculate the heading, then get a
        // panorama from that and set the options
        var getStreetView = function(locationsData, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                var nearStreetViewLocation = locationsData.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                    nearStreetViewLocation, marker.position);
                infowindow.setContent(windowContent + '<div id="pano"></div>');
                var panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 20
                    }
                };
                var panorama = new google.maps.StreetViewPanorama(
                    document.getElementById('pano'), panoramaOptions);
            } else {
                infowindow.setContent(windowContent + '<div style="color: red">No Street View Found</div>');
            }
        };
        // Use streetview service to get the closest streetview image within
        // 50 meters of the markers position
        streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
        // Open the infowindow on the correct marker.
        infowindow.open(map, marker);
    }
}
// stop all animation to all markers
function setallAnimationNull() {
    for (var i = 0; i < mapList.length; i++) {
        mapList[i].setAnimation(null);
    }
}
// add animation to marker
function toggleBounce(marker) {
    if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
    } else {
        //setallAnimationNull();
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function() {
            marker.setAnimation(null);
        }, 1000);
    }

}

// This function takes in a COLOR, and then creates a new marker
// icon of that color. The icon will be 21 px wide by 34 high, have an origin
// of 0, 0 and be anchored at 10, 34).
function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34));
    return markerImage;
}