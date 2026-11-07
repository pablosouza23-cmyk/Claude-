# Authoritative profile/economy backend.
FROM python:3.12-slim
WORKDIR /app
# cryptography is only needed for EOS token verification (BR_AUTH_MODE=eos).
RUN pip install --no-cache-dir cryptography==43.0.3 && useradd --system --uid 10001 br && mkdir /data && chown br /data
COPY brbackend ./brbackend
USER br
ENV BR_AUTH_MODE=eos
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/v1/health',timeout=2)"
CMD ["python", "-m", "brbackend.server", "--port", "8080", "--db", "/data/profiles.db"]
