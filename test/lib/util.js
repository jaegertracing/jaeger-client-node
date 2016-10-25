import fs from 'fs';
import MockTCollector from './mock_tcollector.js';
import TChannel from 'tchannel';
import HyperbahnClient from 'tchannel/hyperbahn';

function getTCollectorChannel(options, callback) {
    if (!options) {
        options = {};
    }
    // WARNING calling getTCollectorChannel in a beforeEach/afterEach test manor won't
    // work well because hyperbahn takes some time close, and the connection will
    // reopen before hyprbahn has caught up.
    function cleanup(tcollectorChannel, done) {
        tcollectorChannel.close();

        if (done) {
            done();
        }
    }

    if (!options.host && !options.port) {
        throw 'No host or port';
    }

    let topLevelChannel = TChannel({
        logger: options.logger,
        requestDefaults: {
            trace: true
        }
    });

    if (options.reporter) {
        topLevelChannel.tracer.reporter = function report(span) {
            options.reporter.report(span);
        };
    }

    let tcollectorChannel = topLevelChannel.makeSubChannel({
        serviceName: options.channelName,
        peers: [options.host +':'+ options.port],
        topChannel: topLevelChannel
    });


    callback(tcollectorChannel, function() {
        cleanup(tcollectorChannel,
            function done() {
                tcollectorChannel.topChannel.close();
            });
    });
}

function getMockCollector(options, callback) {
    if (!options) {
        options = {};
    }

    function cleanup(mockTCollector, done) {
        done();
    }

    let mockTCollector;
    getTCollectorChannel(options, function(tcollectorChannel, done) {
        function callbackWithCleanup() {
            cleanup(mockTCollector, done);
        }

        mockTCollector = new MockTCollector({
            logger: options.logger,
            channel: tcollectorChannel
        });

        if (options.host && options.port) {
            tcollectorChannel.topChannel.listen(options.port, options.host, function listen() {
                callback(mockTCollector, callbackWithCleanup);
            });
        } else {
            callback(mockTCollector, callbackWithCleanup);
        }
    });
}

module.exports = {
    getTCollectorChannel: getTCollectorChannel,
    getMockCollector: getMockCollector
};
