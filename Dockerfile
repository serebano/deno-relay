# To be run in the root of the turbo monorepo
# NOTE: It's highly raccomended to use the new builder, Buildkit. https://docs.docker.com/build/buildkit/

## USAGE:

# Build:        docker buildx build -t serebano/deno-relay:latest .
# Run:          docker run -p 8081:8081 --env-file ./.env --rm --name tictapp-$PROJECT_REF-relay serebano/deno-relay
# Deploy:       docker push serebano/deno-relay:latest

# Clean build:
#    docker buildx build --no-cache -t serebano/deno-relay:latest .
#    docker builder prune

FROM lukechannings/deno:v1.28.0

EXPOSE 8081
WORKDIR /app
USER deno

COPY . ./
RUN deno cache src/index.ts

CMD ["run", "--allow-read", "--allow-net", "--allow-env", "src/index.ts"]
