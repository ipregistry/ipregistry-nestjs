# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-09

### Added

- `IpregistryModule` with `forRoot` and `forRootAsync` registration, global by
  default, building the `IpregistryClient` at bootstrap and failing fast when
  no API key is configured (`IPREGISTRY_API_KEY`, `IPREGISTRY_BASE_URL` with
  the `eu` shorthand, `IPREGISTRY_TIMEOUT`, `IPREGISTRY_FIELDS`, and
  `IPREGISTRY_DEVELOPMENT_IP` environment variables, or explicit options).
- `IpregistryService` exposing the full SDK surface (single, batch, and
  origin lookups for IPs and ASNs, user agent parsing) plus request-aware
  enrichment (`lookupRequest`) that extracts the client IP, skips private
  addresses, memoizes per request, and never throws.
- `IpregistryInterceptor` and `IpregistryMiddleware` to enrich incoming
  requests on both the Express and Fastify platforms.
- `IpregistryCountriesGuard` and `IpregistryThreatsGuard` with the
  self-contained `@BlockCountries()`, `@AllowCountries()`, and
  `@BlockThreats()` decorators (no separate `@UseGuards()` needed), per
  route, per controller, or application-wide through module options and
  `APP_GUARD`, plus `@SkipIpregistry()` to opt routes out of globally
  registered enrichment and blocking.
- `@Ipregistry()` (with property plucking, e.g. `@Ipregistry('data')`) and
  `@ClientIp()` parameter decorators, and `getIpregistryContext` to read
  enriched data from raw request objects.
- Trusted-proxy IP extraction presets (`auto`, `cloudflare`, `nginx`,
  `vercel`, `forwarded-for`, `socket`), custom headers, and custom
  extractors, with strict IP validation and anonymized logging.
- GDPR helper `isEuVisitor`, threat helper `isThreat`, and local bot check
  `isBot`.
- Fail-open behavior by default with an opt-in fail-closed mode
  (`failOpen: false`) answering 503, and an `onError` monitoring hook.
- Testing utilities in `@ipregistry/nestjs/testing`: `FakeIpregistryClient`
  with canned responses and call recording, plus the `createIpInfo`,
  `createUserAgent`, and `createAutonomousSystem` fixture builders.
