/**
 * This is a lttle helper module that manages accounts that require captcha.
 * Captchas that are required are flagged here, checking if captchas are 
 * required (before asking niantic) happens here and flagging captchas
 * as complete happens here. 
 */

var captchaList = {}

/**
 * Flag a catpcha as required.
 */
function required(username, captchaUrl) {
    captchaList[username] = {
        url: captchaUrl,
        token: null
    };
}


/**
 * Flag a captcha as complete.
 */
function complete(username, token) {
    if(username in captchaList)
        delete captchaList[username];
}


/**
 * Check if a username is required to pass captcha.
 */
function isRequired(username) {
    return username in captchaList;
}


/**
 * Get the token from a completed captcha.
 */
function getToken(username) {
    if(username in captchaList)
        return captchaList[username].token;
    else
        return null;
}


/**
 * Flag a captcha as complete.
 */
function setToken(username, token) {
    if(username in captchaList)
        captchaList[username].token = token;
}


/**
 * Get all required captchas.
 */
function getCaptchaList() {
    return captchaList;
}


// Build module.
module.exports = {
    required: required,
    complete: complete,
    isRequired: isRequired,
    getToken: getToken,
    setToken: setToken,
    getCaptchaList: getCaptchaList
}