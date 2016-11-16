var POGOProtos      = require('node-pogo-protos');
var pogoSignature   = require('node-pogo-signature');
var bluebird        = require('bluebird');
var Long            = require('long');
var _               = require('lodash');
var request         = require('request');
var s2              = require('s2-geometry').S2;
var pogobuf         = require('pogobuf');
var winston         = require('winston'); 

/**
 * Helper method for handling tutorial completion.
 */
module.exports = function(client, account, tutorialState, callback, logger) {
    logger = logger || winston;

    /**
     * Step 1: Mark legal screen
     */
    function step1() {
        if(_.includes(tutorialState, POGOProtos.Enums.TutorialState.LEGAL_SCREEN)) {
            logger.info("Tutorial 1/X - Already done.");
            step23();
            return;
        }

        // STEP 1: MARK LEGAL_SCREEN
        client.markTutorialComplete([POGOProtos.Enums.TutorialState.LEGAL_SCREEN], false, false).then(function(resp) {
            logger.info("Tutorial 1/X");
            setTimeout(step23, 5000);
        });
    }


    /**
     * Step 2 & 3: Select avatar
     */
    function step23() {
        if(_.includes(tutorialState, POGOProtos.Enums.TutorialState.AVATAR_SELECTION)) {
            logger.info("Tutorial 3/X - Already done.");
            logger.info("Tutorial 2/X - Already done.");
            step4();
            return;
        }

        // STEP 2: SET AVATAR
        client.setAvatar(0, 0, 0, 0, 0, 0, POGOProtos.Enums.Gender.MALE, 0, 0).then(function(resp) {
            logger.info("Tutorial 2/X");
            setTimeout(function() {

                // STEP 3: MARK AVATAR_SELECTION
                client.markTutorialComplete([POGOProtos.Enums.TutorialState.AVATAR_SELECTION], false, false).then(function(resp2) {
                    logger.info("Tutorial 3/X");
                    setTimeout(step4, 5000);
                });
            }, 5000);
        });
    }


    /**
     * Step 4: Catch starter pokemon.
     * TODO: Random between bulba, squirtle, charmander?
     */
    function step4() {
        if(_.includes(tutorialState, POGOProtos.Enums.TutorialState.POKEMON_CAPTURE)) {
            logger.info("Tutorial 4/X - Already done.");
            step56();
            return;
        }

        // STEP 4: CATCH POKEMON
        client.encounterTutorialComplete(POGOProtos.Enums.PokemonId.BULBASAUR).then(function() {
            logger.info("Tutorial 4/X");
            setTimeout(step56, 5000);
        });
    }


    /**
     * Step 5 & 6 : Codename selection.
     */
    function step56(prefix) {
        if(_.includes(tutorialState, POGOProtos.Enums.TutorialState.NAME_SELECTION)) {
            logger.info("Tutorial 5/X - Already done.");
            logger.info("Tutorial 6/X - Already done.");
            step7();
            return;
        }

        prefix = prefix || "";

        // STEP 5a: CHECK AVAILABLE NAME.
        client.checkCodenameAvailable(account.username + prefix).then(function(resp) {
            if(resp.is_assignable) {
                logger.info("Setting name to ", account.username + prefix);

                // STEP 5b: CLAIM NAME
                client.claimCodename(account.username + prefix).then(function(resp2) {
                    logger.info("Tutorial 5/X");
                    setTimeout(function() {

                        // STEP 6: MARK NAME_SELECTION
                        client.markTutorialComplete([POGOProtos.Enums.TutorialState.NAME_SELECTION], false, false).then(function() {
                            logger.info("Tutorial 6/X");
                            setTimeout(step7, 5000);
                        })
                    }, 5000);
                });
            } else 
                setTimeout(function() { step56(prefix + "1"); }, 5000);
        });
    }


    /**
     * Step 7: Mark first time experience.
     */
    function step7() {
        if(_.includes(tutorialState, POGOProtos.Enums.TutorialState.FIRST_TIME_EXPERIENCE_COMPLETE)) {
            logger.info("Tutorial 7/X - Already done.");
            callback();
            return;
        }

        // STEP 7: MARK FIRST_TIME_EXPERIENCE_COMPLETE
        client.markTutorialComplete([POGOProtos.Enums.TutorialState.FIRST_TIME_EXPERIENCE_COMPLETE], false, false).then(function(resp) {
            logger.info("Tutorial 7/X");
            setTimeout(callback, 5000);
        });       
    }

    // Run the first step.
    step1();
}