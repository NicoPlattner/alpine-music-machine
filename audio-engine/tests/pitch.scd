// Non-real-time render through the same native UGen used by engine.scd.
(
var rate = "TEST_SPEED".getenv.asFloat;
var def = SynthDef(\pitchTest, {
    Out.ar(0, RubberBand.ar(2, 0, rate: rate, pitchShift: 1,
        loop: 0, engine: 1, window: 1, channelMode: 1));
});
var score = Score([
    [0, [\d_recv, def.asBytes]],
    [0, [\b_allocRead, 0, "/tmp/pitch-input.wav"]],
    [0.01, [\s_new, \pitchTest, 1000, 0, 0]],
    [(3 / rate) + 0.3, [\n_free, 1000]]
]);
score.recordNRT(outputFilePath: "/tmp/pitch-output.wav",
    sampleRate: 48000, headerFormat: "WAV", sampleFormat: "int16",
    options: ServerOptions.new.numOutputBusChannels_(2).numInputBusChannels_(0),
    action: { 0.exit });
)
