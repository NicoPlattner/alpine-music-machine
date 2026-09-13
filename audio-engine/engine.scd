// Each MIDI track becomes a Pbind; Ppar starts the enabled tracks together.
(
var tracks=IdentityDictionary.new, settings=IdentityDictionary.new, master, clock, player, soundfont, generation=0, speed=1.0, techno=0, playing=false, position=0.0, changedAt=0.0, duration=0.0, currentPosition, stopPlayer, startPlayer, patternFor, controlPatternFor, technoPatternFor;
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
      program=~program.asInteger, sustain=~sustain, token=generation;
  soundfont.sendMsg("/soundfont/note-on",channel,note,velocity,program);
  thisThread.clock.sched(sustain,{if(token==generation,{soundfont.sendMsg("/soundfont/note-off",channel,note)});nil});
 });
 Event.addEventType(\soundfontControl,{
  var channel=~chan.asInteger, command=~command.asInteger;
  if(command==176,{soundfont.sendMsg("/soundfont/cc",channel,~data1.asInteger,~data2.asInteger)});
  if(command==224,{soundfont.sendMsg("/soundfont/pitch-bend",channel,(~data1+(~data2*128)).asInteger)});
 });
 SynthDef(\master,{|audible=0,reverb=0,drive=0|
  var dry=SoundIn.ar([0,1]);
  var amount=drive.clip(0,1);
  var driven=dry+((((dry*(1+(amount*4))).tanh)-dry)*amount);
  var wet=FreeVerb2.ar(driven[0],driven[1],reverb.clip(0,0.7),0.72,0.4);
  // With reverb=0 and drive=0 (Pop), this is the untouched FluidSynth output.
  Out.ar(0,wet*Lag.kr(audible,0.03));
 }).add; s.sync;
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
 controlPatternFor={|track, fromSeconds|
  var fromTick=fromSeconds * ~midiBpm / 60 * ~midiDivision;
  var prior=IdentityDictionary.new;
  var source=track[\events].select({|event|[176,224].includes(event[1])});
  var events, durations;
  source.do({|event|if(event[0]<=fromTick,{
   var key=if(event[1]==176,{("cc"++event[3]).asSymbol},{\pitchBend});
   prior[key]=event.copy.put(0,fromTick);
  })});
  events=(prior.values.asArray++source.select({|event|event[0]>fromTick})).sort({|a,b|a[0]<b[0]});
  durations=events.collect({|event,i|if(i<(events.size-1),{(events[i+1][0]-event[0])/~midiDivision},{0.01})});
  if(events.isEmpty,{Pbind(\type,\rest,\dur,0.01)},{Pseq([
   Pbind(\type,\rest,\dur,Pseq([(events[0][0]-fromTick)/~midiDivision],1)),
   Pbind(\type,\soundfontControl,
    \command,Pseq(events.collect({|event|event[1]}),1),
    \chan,Pseq(events.collect({|event|event[2]}),1),
    \data1,Pseq(events.collect({|event|event[3]}),1),
    \data2,Pseq(events.collect({|event|event[4]}),1),
    \dur,Pseq(durations,1))
  ],1)})
 };
 technoPatternFor={|fromSeconds|
  var fromBeat=fromSeconds * ~midiBpm / 60;
  var kicks=tracks['track-10'][\notes].select({|note|[35,36].includes(note[2])});
  var origin=if(kicks.isEmpty,{0},{kicks[0][0]/~midiDivision});
  var rhythmLine={|note, spacing, phase, velocity, sustain=0.08|
   var wait=(origin+phase-fromBeat).mod(spacing);
   Pseq([
    Pbind(\type,\rest,\dur,Pseq([wait],1)),
    Pbind(\type,\soundfont,\midinote,note,\velocity,Pfunc({(velocity*settings['track-10'][\gain]).round.clip(0,127)}),\program,25,
     \chan,9,\sustain,sustain,\dur,spacing)
   ],1)
  };
  Ppar([
   // Replace the source kit, anchored to its first kick. The source bass
   // alone supplies the harmony: no unrelated repeating bass underneath it.
   rhythmLine.(36,1,0,106,0.12),
   rhythmLine.(39,2,1,72,0.08)
  ])
 };
 stopPlayer={generation=generation+1;if(player.notNil,{player.stop;player=nil});soundfont.sendMsg("/soundfont/all-notes-off")};
 startPlayer={|at|
  var patterns=Array.new;
  stopPlayer.();
  tracks.values.asArray.select({|track|settings[track[\id].asSymbol][\active]>0}).do({|track|
   patterns=patterns.add(controlPatternFor.(track,at));
   if((techno>0) and:{track[\channel]==9},{patterns=patterns.add(technoPatternFor.(at))},{patterns=patterns.add(patternFor.(track,at))});
  });
  master.set(\audible,patterns.notEmpty.binaryValue);
  if(patterns.notEmpty,{player=Ppar(patterns).play(clock,quant:0)})
 };
 OSCdef(\midiState,{|m|var index=1;while({index<m.size},{var id=m[index].asString.asSymbol;settings[id]=(active:m[index+1].asFloat.clip(0,1),voice:m[index+2].asFloat.clip(0,127),gain:m[index+3].asFloat.clip(0,1.5));index=index+4});if(playing,{var at=currentPosition.();stopPlayer.();startPlayer.(at)})},"/midi/state");
 OSCdef(\style,{|m|
  var previous=techno;
  master.set(\reverb,m[1].asFloat,\drive,m[2].asFloat);techno=(m[3]?0).asFloat.clip(0,1);
  if(playing and:{previous!=techno},{var at=currentPosition.();stopPlayer.();startPlayer.(at)})
 },"/mixer/style");
 OSCdef(\speed,{|m|position=currentPosition.();speed=m[1].asFloat.clip(0.5,1.5);clock.tempo=(~midiBpm/60)*speed;changedAt=SystemClock.seconds;if(playing,{startPlayer.(position)})},"/transport/speed");
 OSCdef(\play,{playing=true;changedAt=SystemClock.seconds;clock.tempo=(~midiBpm/60)*speed;startPlayer.(position);master.set(\audible,1)},"/transport/play");
 OSCdef(\pause,{position=currentPosition.();playing=false;stopPlayer.();master.set(\audible,0)},"/transport/pause");
 OSCdef(\seek,{|m|position=m[1].asFloat.clip(0,duration);changedAt=SystemClock.seconds;if(playing,{stopPlayer.();startPlayer.(position)})},"/transport/seek");
 Routine({inf.do({if(playing and: {currentPosition.() >= duration},{position=duration;playing=false;stopPlayer.();master.set(\audible,0)});0.1.wait})}).play(SystemClock);
 ("MIDI Pbind mixer ready: "++tracks.size++" tracks at "++~midiBpm++" BPM, "++duration++"s").postln;File.use("/tmp/mixer-ready","w",{|f|f.write("ready")});
});
)
