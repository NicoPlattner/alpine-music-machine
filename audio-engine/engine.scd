// Each MIDI track becomes a Pbind; Ppar starts the enabled tracks together.
(
var tracks=IdentityDictionary.new, settings=IdentityDictionary.new, mixBus, master, noteGroup, clock, player, speed=1.0, playing=false, position=0.0, changedAt=0.0, duration=0.0, currentPosition, stopPlayer, startPlayer, patternFor;
s.options.numOutputBusChannels=2; s.options.numInputBusChannels=0; s.options.sampleRate=48000; s.options.memSize=262144; s.options.maxNodes=2048; s.latency=0.12;
s.waitForBoot({
 var secondsForTick={|tick| tick / ~midiDivision * (60 / ~midiBpm) };
 thisProcess.interpreter.executeFile("/tmp/midi-arrangement.scd");
 ~midiTracks.do({|track| var finalTick=track[\notes].collect({|note| note[0]+note[1] }).maxItem ? 0;
  tracks[track[\id].asSymbol]=track; settings[track[\id].asSymbol]=(active:1,voice:0,gain:0.8); duration=duration.max(secondsForTick.(finalTick));
 }); mixBus=Bus.audio(s,2); clock=TempoClock.new(~midiBpm / 60);
 // Per-track voices are selected by the Pop, Ballad, Rock and Techno maps.
 // Tempo scheduling changes speed; it never changes MIDI pitch.
 // Build only the chosen instrument graph for each note.
 [
  {|f| Mix(SinOsc.ar(f*[1,2.01,3.99],0,[0.65,0.16,0.07]))},
  {|f| LPF.ar((Saw.ar(f*[0.995,1.005]).sum*1.5).tanh,4500)},
  {|f| SinOsc.ar(f)+(LPF.ar(Pulse.ar(f,0.45),600)*0.35)},
  {|f| LPF.ar(Pulse.ar(f*[1,1.005],[0.43,0.51]).sum*0.5,2200)},
  {|f| Mix(SinOsc.ar(f*[1,2,3.02],0,[0.7,0.2,0.08]))},
  {|f| LPF.ar(Saw.ar(f*[0.997,1.003]).sum*0.35,3500)},
  {|f| Mix(SinOsc.ar(f*[1,2,3],0,[0.55,0.25,0.15]))},
  {|f| LPF.ar((Saw.ar(f*[1,1.005]).sum*2).tanh,6500)},
  {|f| RLPF.ar(Saw.ar(f), (f*5).clip(300,7000),0.5)*0.6},
  {|f| SinOsc.ar(f*(1+SinOsc.kr(5,0,0.002))) + SinOsc.ar(f*2,0,0.08)},
  // Bowed violin/cello: vibrato and resonant body, with a slow attack below.
  {|f| var x=Saw.ar(f*(1+SinOsc.kr(5.5,0,0.003))); LPF.ar(x,6500)*0.4+BPF.ar(x,2400,0.5)*0.25},
  {|f| var x=Saw.ar(f*(1+SinOsc.kr(4.5,0,0.002))); LPF.ar(x,1800)*0.55+BPF.ar(x,220,0.6)*0.3},
  {|f| SinOsc.ar(f)*0.8+SinOsc.ar(f*2,0,0.18)+LPF.ar(WhiteNoise.ar(0.06),900)},
  {|f| Mix(SinOsc.ar(f*[1,2,3,4],0,[0.7,0.22,0.1,0.03]))},
  {|f| Mix(SinOsc.ar(f*[1,3,5,7],0,[0.65,0.2,0.08,0.03]))},
  {|f| LPF.ar(Saw.ar(f),f*3)*0.5+SinOsc.ar(f,0,0.3)},
  {|f| Mix(SinOsc.ar(f*[1,4,10],0,[0.7,0.12,0.03]))*SinOsc.kr(5,0,0.12,0.88)},
  {|f| LPF.ar(Pulse.ar(f,0.35),2400)*0.45+SinOsc.ar(f,0,0.4)},
  {|f| SinOsc.ar(f,0,0.9)+SinOsc.ar(f*2,0,0.08)},
  {|f| var x=Pulse.ar(f*(1+SinOsc.kr(5,0,0.002)),0.4); BPF.ar(x,1200,0.8)*0.4+LPF.ar(x,3500)*0.4}
 ].do({|sound,i|
  SynthDef(("midiTone"++i).asSymbol,{|out=0,midinote=60,amp=0.1,hold=0.2|
   var bowed=[5,10,11].includes(i), plucked=[0,4,12,13,16,17].includes(i);
   var attack=if(bowed,{0.055},{0.006});
   var env=EnvGen.kr(Env.linen(attack,hold.max(0.001),if(bowed,{0.15},{0.06})),doneAction:2);
   if(plucked,{env=env*EnvGen.kr(Env([1,0.22],[if(i==13,{1.2},{0.65})],-4))});
   Out.ar(out,(sound.(midinote.midicps)!2)*env*amp);
  }).add;
 });
 SynthDef(\midiDrums,{|out=0,midinote=36,amp=0.6,voice=0|
  var env=EnvGen.kr(Env.perc(0.001,0.25),doneAction:2), kick=SinOsc.ar(EnvGen.kr(Env([130,42],[0.05],-8)))*env;
  var snare=(WhiteNoise.ar*EnvGen.kr(Env.perc(0.001,0.14)))+(SinOsc.ar(190)*env*0.4), hat=HPF.ar(WhiteNoise.ar,6500)*EnvGen.kr(Env.perc(0.001,0.05));
  var sig=Select.ar((midinote>40)+(midinote>49),[kick,snare,hat]);
  sig=LPF.ar(sig,Select.kr(voice,[16000,14000,7500,19000,6000,8000,10000,18000]));
  Out.ar(out,(sig!2)*amp);
 }).add;
 SynthDef(\master,{|in=0,audible=0,reverb=0,drive=0| var sig=In.ar(in,2); sig=(sig*(1+(drive*4))).tanh; sig=FreeVerb2.ar(sig[0],sig[1],reverb.clip(0,0.7),0.72,0.4); Out.ar(0,Limiter.ar(sig*Lag.kr(audible,0.03),0.92)) }).add; s.sync;
 noteGroup=Group.head(s);
 master=Synth.after(noteGroup,\master,[\in,mixBus]); currentPosition={ if(playing,{position+((SystemClock.seconds-changedAt)*speed)},{position}) };
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
   Pbind(\instrument,Pfunc({(track[\channel]==9).if(\midiDrums,{("midiTone"++settings[track[\id].asSymbol][\voice].asInteger).asSymbol})}),
    \midinote,Pseq(notes.collect({|note|note[2]}),1),
    \amp,Pseq(notes.collect({|note|note[3]/127}),1)*Pfunc({settings[track[\id].asSymbol][\gain]*0.18}),
    \noteLength,Pseq(notes.collect({|note|note[1]/~midiDivision}),1),
    \hasGate,false,\hold,Pfunc({|event|event[\noteLength]/clock.tempo}),
    \dur,Pseq(durations,1),
    \voice,Pfunc({settings[track[\id].asSymbol][\voice]}),\group,noteGroup,\out,mixBus)
  ],1) });
 };
 stopPlayer={if(player.notNil,{player.stop;player=nil}); noteGroup.freeAll};
 startPlayer={|at| var patterns; stopPlayer.(); patterns=tracks.values.asArray.select({|track|settings[track[\id].asSymbol][\active]>0}).collect({|track|patternFor.(track,at)}); master.set(\audible,patterns.notEmpty.binaryValue); if(patterns.notEmpty,{player=Ppar(patterns).play(clock,quant:0)})};
 OSCdef(\midiState,{|m|var index=1;while({index<m.size},{var id=m[index].asString.asSymbol;settings[id]=(active:m[index+1].asFloat.clip(0,1),voice:m[index+2].asFloat.clip(0,19),gain:m[index+3].asFloat.clip(0,1.5));index=index+4});if(playing,{var at=currentPosition.();stopPlayer.();startPlayer.(at)})},"/midi/state");
 OSCdef(\style,{|m|master.set(\reverb,m[1].asFloat,\drive,m[2].asFloat)},"/mixer/style");
 OSCdef(\speed,{|m|position=currentPosition.();speed=m[1].asFloat.clip(0.5,1.5);clock.tempo=(~midiBpm/60)*speed;changedAt=SystemClock.seconds;if(playing,{startPlayer.(position)})},"/transport/speed");
 OSCdef(\play,{playing=true;changedAt=SystemClock.seconds;clock.tempo=(~midiBpm/60)*speed;startPlayer.(position);master.set(\audible,1)},"/transport/play");
 OSCdef(\pause,{position=currentPosition.();playing=false;stopPlayer.();master.set(\audible,0)},"/transport/pause");
 OSCdef(\seek,{|m|position=m[1].asFloat.clip(0,duration);changedAt=SystemClock.seconds;if(playing,{stopPlayer.();startPlayer.(position)})},"/transport/seek");
 Routine({inf.do({if(playing and: {currentPosition.() >= duration},{position=duration;playing=false;stopPlayer.();master.set(\audible,0)});0.1.wait})}).play(SystemClock);
 ("MIDI Pbind mixer ready: "++tracks.size++" tracks at "++~midiBpm++" BPM, "++duration++"s").postln;File.use("/tmp/mixer-ready","w",{|f|f.write("ready")});
});
)
