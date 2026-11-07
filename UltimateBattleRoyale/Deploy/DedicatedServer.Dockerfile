# Linux dedicated server image. Build the server first (needs a source build of UE 5.4):
#   RunUAT BuildCookRun -project=UltimateBattleRoyale.uproject -server -serverplatform=Linux -noclient \
#     -cook -build -stage -pak -archive -archivedirectory=Build/Server
# then: docker build -f Deploy/DedicatedServer.Dockerfile -t ubr-server .
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10002 --create-home ue
WORKDIR /home/ue/server
COPY --chown=ue Build/Server/LinuxServer/ ./
USER ue
ENV BR_MODE=Solo
EXPOSE 7777/udp
# BR_SERVER_SECRET (shared with the backend) and the backend URL come from the orchestrator, never the image.
ENTRYPOINT ["/bin/sh", "-c", "./UltimateBattleRoyaleServer.sh \"/Engine/Maps/Entry?game=BR?Mode=${BR_MODE}\" -port=7777 -log ${BR_BACKEND:+-BRBackend=$BR_BACKEND}"]
