# syntax=docker/dockerfile:1

# ---- 1. Build the React app ----
FROM node:24-alpine AS web
WORKDIR /web
COPY src/web/package.json src/web/package-lock.json ./
RUN npm ci
COPY src/web/ ./
RUN npm run build

# ---- 2. Publish the ASP.NET Core API and build the migration bundle ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY global.json dotnet-tools.json ./
RUN dotnet tool restore
COPY src/WarmersStore.Api/WarmersStore.Api.csproj src/WarmersStore.Api/
RUN dotnet restore src/WarmersStore.Api/WarmersStore.Api.csproj
COPY src/WarmersStore.Api/ src/WarmersStore.Api/
RUN dotnet publish src/WarmersStore.Api/WarmersStore.Api.csproj \
    -c Release -o /app/publish --no-restore -p:UseAppHost=false
# Standalone executable that applies pending migrations; run before each deploy.
RUN dotnet ef migrations bundle --project src/WarmersStore.Api \
    --configuration Release --output /app/publish/efbundle

# ---- 3. Runtime image ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    Media__Root=/data/media
COPY --from=api /app/publish ./
COPY --from=web /web/dist ./wwwroot
# Uploaded images live here; mount a volume at /data/media so they survive redeploys.
# Owned by the app user so the non-root process can write to it.
RUN mkdir -p /data/media && chown $APP_UID /data/media
# Non-root user provided by the .NET base image.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "WarmersStore.Api.dll"]
