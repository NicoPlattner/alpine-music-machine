FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive QT_QPA_PLATFORM=offscreen
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg jackd2 jack-tools python3 supercollider-language supercollider-server && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 supercollider
WORKDIR /engine
COPY engine.scd entrypoint.sh prepare_midi.py ./
COPY tests ./tests
RUN chmod +x entrypoint.sh
USER supercollider
EXPOSE 57120/udp
ENTRYPOINT ["./entrypoint.sh"]
