(
var paths = IdentityDictionary[\backing->"/music/Shape of You Backing.flac", \bass->"/music/Shape of You Bass.flac", \drums->"/music/Shape of You Drums.flac", \guitar->"/music/Shape of You Guitar.flac", \vocals->"/music/Shape of You Vocals.flac"];
var buffers=IdentityDictionary.new, stems=IdentityDictionary.new, mixBus, master;
var speed=1.0, playing=false, duration;
s.options.numOutputBusChannels=2; s.options.numInputBusChannels=0; s.options.sampleRate=48000; s.options.memSize=262144; s.latency=0.05;
s.waitForBoot({
 paths.keysValuesDo({|name,path| buffers[name]=Buffer.read(s,path)}); s.sync;
 duration=buffers.values.first.duration; mixBus=Bus.audio(s,2);
 SynthDef(\rbTonal,{|out=0,buf=0,volume=1,speed=1,startFrame=0,t_seek=0,active=0|
  var sig=RubberBand.ar(2,buf,rate:speed.clip(0.5,1.5),pitchShift:1,trig:t_seek,startPos:startFrame,loop:0,engine:1,window:1,channelMode:1);
  Out.ar(out,sig*Lag.kr(volume*active,0.03));
 }).add;
 SynthDef(\rbPercussive,{|out=0,buf=0,volume=1,speed=1,startFrame=0,t_seek=0,active=0|
  var sig=RubberBand.ar(2,buf,rate:speed.clip(0.5,1.5),pitchShift:1,trig:t_seek,startPos:startFrame,loop:0,engine:0,window:0,channelMode:1);
  Out.ar(out,sig*Lag.kr(volume*active,0.03));
 }).add;
 SynthDef(\master,{|in=0,audible=0,bass=0,treble=0,reverb=0,compression=0|
  var dry=In.ar(in,2), toned, wet, threshold, compressed;
  toned=BLowShelf.ar(dry,120,1,Lag.kr(bass,0.08));
  toned=BHiShelf.ar(toned,6000,1,Lag.kr(treble,0.08));
  wet=FreeVerb2.ar(toned[0],toned[1],Lag.kr(reverb,0.08),0.72,0.45);
  threshold=1-(Lag.kr(compression,0.08)*0.75);
  compressed=Compander.ar(wet,wet,threshold,1,0.35,0.01,0.12);
  Out.ar(0,Limiter.ar(compressed*Lag.kr(audible,0.03),0.95,0.01))
 }).add; s.sync;
 // Construct and suspend all players in one timestamped bundle. Use the same
 // engine for every stem so percussion and vocals have the same startup delay.
 s.bind({ buffers.keysValuesDo({|name,buf| stems[name]=Synth(\rbTonal,[\buf,buf,\out,mixBus]); stems[name].run(false)}) });
 master=Synth.tail(nil,\master,[\in,mixBus]);
 OSCdef(\volume,{|m| var n=m[1].asString.toLower.asSymbol; if(stems[n].notNil){stems[n].set(\volume,m[2].asFloat.clip(0,1.5))}},"/mixer/volume");
 OSCdef(\effects,{|m| master.set(\bass,m[1].asFloat.clip(-12,12),\treble,m[2].asFloat.clip(-12,12),\reverb,m[3].asFloat.clip(0,1),\compression,m[4].asFloat.clip(0,1))},"/mixer/effects");
 OSCdef(\speed,{|m| speed=m[1].asFloat.clip(0.5,1.5); s.bind({stems.values.do({|x|x.set(\speed,speed)})})},"/transport/speed");
 OSCdef(\play,{playing=true; s.bind({stems.values.do({|x|x.run(true); x.set(\active,1)}); master.set(\audible,1)})},"/transport/play");
 OSCdef(\pause,{playing=false; s.bind({master.set(\audible,0); stems.values.do({|x|x.run(false)})})},"/transport/pause");
 OSCdef(\seek,{|m| var frame=(m[1].asFloat.clip(0,duration)*48000).round; s.bind({stems.values.do({|x|x.set(\startFrame,frame,\t_seek,1)})})},"/transport/seek");
 ("Live mixer ready: Rubber Band pitch-preserving stem processors, "++duration++"s").postln;
 File.use("/tmp/mixer-ready","w",{|f|f.write("ready")});
});
)
