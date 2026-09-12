// Each MIDI track becomes a Pbind; Ppar starts the enabled tracks together.
(
var tracks=IdentityDictionary.new, settings=IdentityDictionary.new, master, clock, player, soundfont, speed=1.0, playing=false, position=0.0, changedAt=0.0, duration=0.0, currentPosition, stopPlayer, startPlayer, patternFor;
s.options.numOutputBusChannels=2; s.options.numInputBusChannels=2; s.options.sampleRate=48000; s.options.memSize=262144; s.options.maxNodes=2048; s.latency=0.12;
s.waitForBoot({
 var secondsForTick={|tick| tick / ~midiDivision * (60 / ~midiBpm) };
 thisProcess.interpreter.executeFile("/tmp/midi-arrangement.scd");
 ~midiTracks.do({|track| var finalTick=track[\notes].collect({|note| note[0]+note[1] }).maxItem ? 0;
  tracks[track[\id].asSymbol]=track; settings[track[\id].asSymbol]=(active:1,voice:track[\program],gain:1.0); duration=duration.max(secondsForTick.(finalTick));
 }); clock=TempoClock.new(~midiBpm / 60);
 // Pbind still owns timing; each event asks FluidSynth to render a sampled GM
 // instrument from the system SoundFont instead of building an oscillator.
 soundfont=NetAddr("127.0.0.1",57130);
 Event.addEventType(\soundfont,{
  var channel=~chan.asInteger, note=~midinote.asInteger, velocity=~velocity.asInteger,
      program=~program.asInteger, sustain=~sustain;
  soundfont.sendMsg("/soundfont/note-on",channel,note,velocity,program);
  thisThread.clock.sched(sustain,{soundfont.sendMsg("/soundfont/note-off",channel,note);nil});
 });
 SynthDef(\master,{|audible=0,reverb=0,drive=0| var sig=SoundIn.ar([0,1]); sig=(sig*(1+(drive*4))).tanh; sig=FreeVerb2.ar(sig[0],sig[1],reverb.clip(0,0.7),0.72,0.4); Out.ar(0,Limiter.ar(sig*Lag.kr(audible,0.03),0.92)) }).add; s.sync;
 master=Synth(\master); currentPosition={ if(playing,{position+((SystemClock.seconds-changedAt)*speed)},{position}) };
 // Convert absolute MIDI ticks to Pbind event streams. Seeking creates new
 // streams beginning at the requested MIDI beat, so events remain quantized.
 patternFor={|track, fromSeconds|
  var fromTick=fromSeconds * ~midiBpm / 60 * ~midiDivision;
  var notes=track[\notes].select({|note| (note[0]+note[1]) > fromTick }).collect({|note|
   var start=note[0].max(fromTick); [start,note[0]+note[1]-start,note[2],note[3]]
  }).sort({|a,b| a[0]<b[0] });
  var durations=notes.collect({|note,i| if(i < (notes.size-1),{(notes[i+1][0]-note[0])/~midiDivision},{0.01}) });
  if(notes.isEmpty,{ Pbind(\type,\rest,\dur,0.01) },{ Pseq([
   Pbind(\type,\rest,\dur,Pseq([if(notes.isEmpty,{0.01},{(notes[0][0]-fromTick)/~midiDivision})],1)),
   Pbind(\type,\soundfont,
    \midinote,Pseq(notes.collect({|note|note[2]}),1),
    \sourceVelocity,Pseq(notes.collect({|note|note[3]}),1),
    \velocity,Pfunc({|event|(event[\sourceVelocity]*settings[track[\id].asSymbol][\gain]).round.clip(1,127)}),
    \noteLength,Pseq(notes.collect({|note|note[1]/~midiDivision}),1),
    \sustain,Pkey(\noteLength),
    \dur,Pseq(durations,1),
    \program,Pfunc({settings[track[\id].asSymbol][\voice]}),\chan,track[\channel])
  ],1) });
 };
 stopPlayer={if(player.notNil,{player.stop;player=nil});soundfont.sendMsg("/soundfont/all-notes-off")};
 startPlayer={|at| var patterns; stopPlayer.(); patterns=tracks.values.asArray.select({|track|settings[track[\id].asSymbol][\active]>0}).collect({|track|patternFor.(track,at)}); master.set(\audible,patterns.notEmpty.binaryValue); if(patterns.notEmpty,{player=Ppar(patterns).play(clock,quant:0)})};
 OSCdef(\midiState,{|m|var index=1;while({index<m.size},{var id=m[index].asString.asSymbol;settings[id]=(active:m[index+1].asFloat.clip(0,1),voice:m[index+2].asFloat.clip(0,127),gain:m[index+3].asFloat.clip(0,1.5));index=index+4});if(playing,{var at=currentPosition.();stopPlayer.();startPlayer.(at)})},"/midi/state");
 OSCdef(\style,{|m|master.set(\reverb,m[1].asFloat,\drive,m[2].asFloat)},"/mixer/style");
 OSCdef(\speed,{|m|position=currentPosition.();speed=m[1].asFloat.clip(0.5,1.5);clock.tempo=(~midiBpm/60)*speed;changedAt=SystemClock.seconds;if(playing,{startPlayer.(position)})},"/transport/speed");
 OSCdef(\play,{playing=true;changedAt=SystemClock.seconds;clock.tempo=(~midiBpm/60)*speed;startPlayer.(position);master.set(\audible,1)},"/transport/play");
 OSCdef(\pause,{position=currentPosition.();playing=false;stopPlayer.();master.set(\audible,0)},"/transport/pause");
 OSCdef(\seek,{|m|position=m[1].asFloat.clip(0,duration);changedAt=SystemClock.seconds;if(playing,{stopPlayer.();startPlayer.(position)})},"/transport/seek");
 Routine({inf.do({if(playing and: {currentPosition.() >= duration},{position=duration;playing=false;stopPlayer.();master.set(\audible,0)});0.1.wait})}).play(SystemClock);
 ("MIDI Pbind mixer ready: "++tracks.size++" tracks at "++~midiBpm++" BPM, "++duration++"s").postln;File.use("/tmp/mixer-ready","w",{|f|f.write("ready")});
});
)
