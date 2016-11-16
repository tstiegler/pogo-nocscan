/**
 * I planned to have common methods dumped here for usage between components
 * but it ended up just being the one component.
 */

/**
 * Fetch plugin.
 */
function getPlugin(type, name, config) {
    try {
        return require("./plugins/" + type + "." + name + ".js")(config);
    } catch(err) {
        console.log(err);
        return null;
    }
}

// Module.
module.exports = {
    getPlugin: getPlugin
};