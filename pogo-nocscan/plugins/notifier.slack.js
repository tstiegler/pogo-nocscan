var slackNotifier = function(slackConfig) {

    var logger = require('winston');
    var request = require('request');

    /**
     * Raw message send.
     */
    function sendMessage(text) {
        var msg = JSON.parse(JSON.stringify(slackConfig.webhookConfig));
        msg.text = "@" + slackConfig.sentTo + " " + text;

        // logger.info(msg);
        
        var formData = {payload: JSON.stringify(msg)};

        request.post(
            slackConfig.webhookUrl,
            { form: formData},
            function(reqerr, response, body) {
                if (!reqerr && response.statusCode == 200) {
                    logger.info("Slack request ok: ", body);
                } else {
                    logger.info("Slack request error:");
                    logger.info(reqerr);
                    logger.info(body);
                }
            }
        ); 
    }

    /**
     * Send notification email.
     */
    function sendNotification(notifications, pnt, info) {
       try {
            for(var i in notifications) {
                var noti = notifications[i];
                var expiryDate = new Date(noti.expiration);

                var spawnName = noti.name + " - " + noti.distance.toFixed(2) + "m away (Expires: " + formatDate(expiryDate) + ")";
                var mapUrl = "http://maps.google.com/maps?z=12&t=m&q=loc:" + noti.lat + "+" + noti.lng;

                var text = spawnName + " " + mapUrl;

                sendMessage(text);
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
        sendMessage: sendMessage,
        sendNotification: sendNotification,
        setLogger: function(nl) { logger = nl; }
    };
};

module.exports = slackNotifier;