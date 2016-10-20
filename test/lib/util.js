import fs from 'fs';
import MockTCollector from './mock_tcollector.js';
import TChannel from 'tchannel';
import HyperbahnClient from 'tchannel/hyperbahn';

function getHyperbahnClient(options, callback) {
    if (!options) {
        options = {};
    }

    let topLevelChannel = TChannel({
        logger: options.logger,
        requestDefaults: {
            trace: true
        }
    });

    // todo(oibe) talk about creating this in the docs
    let hyperbahnHosts = JSON.parse(fs.readFileSync('/etc/uber/hyperbahn/hosts.json', 'utf8'));

    //todo (oibe) reconsider options on this client
    let hyperbahnClient = HyperbahnClient({
        tchannel: topLevelChannel,
        serviceName: options.hyperbahnClientName || 'tcollector',
        hostPortList: hyperbahnHosts,
        hardFail: true,
        reportTracing: true,
        logger: options.logger
    });

    if (options.reporter) {
        hyperbahnClient.reporter = options.reporter;
    }

    topLevelChannel.listen(0, '127.0.0.1', function onListen() {
        hyperbahnClient.advertise();
    });

    function cleanup(hyperbahnClient, topLevelChannel) {
        hyperbahnClient.destroy();
        // only need to close top level channel and not test channel
        topLevelChannel.close();
    }

    hyperbahnClient.once('advertised', function() {
        callback(hyperbahnClient, function() {
            cleanup(hyperbahnClient, topLevelChannel);
        });
    });
}

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

    if (options.host && options.port) {
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
    } else {
        getHyperbahnClient(options, function clientDone(hyperbahnClient, hyperbahnDone) {
            var tcollectorChannel = hyperbahnClient.getClientChannel({
                serviceName: options.channelName || 'tcollector'
            });

            callback(tcollectorChannel, function clientDone() {
                cleanup(tcollectorChannel, function () {
                    hyperbahnDone();
                });
            });
        });
    }
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
    getHyperbahnClient: getHyperbahnClient,
    getTCollectorChannel: getTCollectorChannel,
    getMockCollector: getMockCollector
};
