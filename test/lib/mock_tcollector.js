import fs from 'fs';
import path from 'path';
import TChannelThrift from 'tchannel/as/thrift';

let zipkinCoreSpec = fs.readFileSync(
    path.join(__dirname, '../../src', 'jaeger-idl', 'thrift', 'zipkinCore.thrift'), 'utf8'
);

let samplingSpec = fs.readFileSync(
    path.join(__dirname, '../../src', 'jaeger-idl', 'thrift', 'sampling.thrift'), 'utf8'
);

export default class MockTCollector {
    _channel: any;

    constructor(options) {
        this._channel = options.channel;

        this._zipkinCoreServerChannel = TChannelThrift({
            channel: this._channel,
            source: zipkinCoreSpec
        });

        this._samplingChannel = TChannelThrift({
            channel: this._channel,
            source: samplingSpec
        });

        this._zipkinCoreServerChannel.register(
            this._channel,
            'ZipkinCollector::submitZipkinBatch',
            this,
            this.onSubmitZipkinBatch
        );

        this._samplingChannel.register(
            this._channel,
            'SamplingManager::getSamplingStrategy',
            this,
            this.onGetSamplingStrategy
        );

        this._zipkinCoreServerChannel.register(
            this._channel,
            'ZipkinCollector::submit',
            this,
            this.onSubmit
        );

        this.spans = [];
    }

    onSubmit(opts, req, head, body, done) {
        this.spans.push(req.span);

        done(null, {ok: true, body: {ok: true}});
    }

    onGetSamplingStrategy(opts, req, head, body, done) {
        if (body.serviceName === 'tcollector-static') {
            done(
                null,
                {
                    ok:true,
                    body: {
                        "strategyType": "PROBABILISTIC",
                        "probabilisticSampling": {
                            "samplingRate": 0.99
                        }
                    }
                }
            );
        } else if (body.serviceName === 'tcollector-rate-limit') {
            done(null, {
                ok: true,
                body: {
                    "strategyType": "RATE_LIMITING",
                    "rateLimitingSampling": {
                        "maxTracesPerSecond": 10
                    }
                }
            });
        } else if (body.serviceName === 'tcollector-error') {
            let error = new Error('this is an error');
            done(error, null);
        } else if (body.serviceName === 'tcollector-not-ok') {
            done(null, {ok: false, typeName: 'bad-response', body: 'not-ok'});
        }
    }

    onSubmitZipkinBatch(opts, req, head, body, done) {
        let responses = [];
        for (let i = 0; i < body.spans.length; i++) {
            let span = body.spans[i];
            if (span.name === 'error') {
                let error = new Error('this is an error');
                done(error, null);
            }

            if (span.name === 'not-ok') {
                done(null, {ok: false, typeName: 'bad-response', body: 'not-ok'});
            }

            responses.push({ok: true});
        }
        done(null, {ok: true, body: responses});
    }

    close() {
        this.channel.close();
    }
}
