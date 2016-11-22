var _ = require("lodash");

var wsConnections = [];

function sendMessage(config, message) {
    _.each(config.notifiers, function(notifier) {
        notifier.sendMessage(message);
    });

    _.each(wsConnections, function(conn) {
        conn.sendText(message);
    })
}

module.exports = {
    sendMessage: sendMessage,
    addWSConection: function(conn) {
        wsConnections.push(conn);
    },
    removeWSConnection: function(conn) {
        wsConnections = _.filter(wsConnections, function(item) { return item != conn; });
    }
}