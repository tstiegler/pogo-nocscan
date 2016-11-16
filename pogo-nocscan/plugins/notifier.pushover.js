var pushoverNotifier = function(pushoverConfig) {

    var logger  = require('winston');
    var push    = require('pushover-notifications');

    var p = new push( {
        user: pushoverConfig.user,
        token: pushoverConfig.token
    });

    /**
     * Send message
     */
    function sendMessage(text) {
        // Setup the push notification data.
        var msg = {                    
            "message": text,
            "title": "Spawn Scraper",
            "sound": 'magic',
            "priority": 1
        };

        // Send over the push notification.
        p.send( msg, function( err, result ) {
            if ( err ) {
                logger.info("Error pushin message");
            }
        });       
    }


    /**
     * Send notification email.
     */
    function sendNotification(notifications, pnt, info) {
       try {
            for(var i in notifications) {
                var noti = notifications[i];
                var expiryDate = new Date(noti.expiration);

                var spawnName = noti.name + " - " + noti.distance + " (Expires: " + formatDate(expiryDate) + ")";
                var mapUrl = "http://maps.google.com/maps?z=12&t=m&q=loc:" + noti.lat + "+" + noti.lng;

                // Setup the push notification data.
                var msg = {                    
                    "message": spawnName,
                    "title": "FPM Scraper",
                    "url": mapUrl,
                    "url_title": "Map",
                    "sound": 'magic',
                    "priority": 1
                };

                // Send over the push notification.
                p.send( msg, function( err, result ) {
                    if ( err ) {
                        logger.info("Error pushing notification for " + spawnName);
                    }
                });
            }
        } catch(err) {
            logger.info("Error in notification sending!");
            logger.info(err);
        }
    }


    /**
     * Date fotmatting, ripped from somewhere.
     */
    function formatDate(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0'+minutes : minutes;
        var strTime = hours + ':' + minutes + ' ' + ampm;
        return date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear() + "  " + strTime;
    }    
    

    // Return module object.
    return {
        sendNotification: sendNotification,
        setLogger: function(nl) { logger = nl; }
    };
};

module.exports = pushoverNotifier;