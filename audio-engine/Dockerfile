FROM ubuntu:24.04 AS plugin-build
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git g++ supercollider-dev librubberband-dev
WORKDIR /build
RUN git clone https://github.com/audionerd/RubberBandUGens.git . && git checkout de0f96ed1a2d920957f13c1abc37ede67a284004 && git submodule update --init --recursive
COPY RubberBand.cpp plugins/RubberBand/RubberBand.cpp
RUN g++ -std=c++14 -O3 -DNDEBUG -fPIC -shared -fvisibility=hidden -I/usr/include/SuperCollider/plugin_interface -I/usr/include/SuperCollider/common plugins/RubberBand/RubberBand.cpp -lrubberband -o RubberBand.so

FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive QT_QPA_PLATFORM=offscreen
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg jackd2 jack-tools supercollider-language supercollider-server && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 supercollider
WORKDIR /engine
COPY --from=plugin-build /build/RubberBand.so /usr/share/SuperCollider/Extensions/RubberBand/
COPY --from=plugin-build /build/plugins/RubberBand/RubberBand.sc /usr/share/SuperCollider/Extensions/RubberBand/
COPY engine.scd entrypoint.sh ./
COPY tests ./tests
RUN chmod +x entrypoint.sh
USER supercollider
EXPOSE 57120/udp
ENTRYPOINT ["./entrypoint.sh"]
