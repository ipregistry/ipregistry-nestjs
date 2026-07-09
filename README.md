[<img src="https://cdn.ipregistry.co/icons/favicon-96x96.png" alt="Ipregistry" width="64"/>](https://ipregistry.co/)

# Ipregistry NestJS Library

[![License](http://img.shields.io/:license-apache-blue.svg)](LICENSE.txt)
[![Actions Status](https://github.com/ipregistry/ipregistry-nestjs/workflows/CI/badge.svg)](https://github.com/ipregistry/ipregistry-nestjs/actions)
[![npm](https://img.shields.io/npm/v/@ipregistry/nestjs.svg)](https://www.npmjs.com/package/@ipregistry/nestjs)

This is the official NestJS integration for the [Ipregistry](https://ipregistry.co) IP geolocation and threat data API. It is built on top of the official [`@ipregistry/client`](https://github.com/ipregistry/ipregistry-javascript) JavaScript SDK and exposes it the NestJS way: a configurable module, an injectable service, guards, an interceptor, middleware, and parameter decorators. Both the Express and Fastify platforms are supported.

```
Request -> enrichment (1 lookup, cached, memoized per request) -> @Ipregistry() in any handler
```

## Features

- `IpregistryModule.forRoot` / `forRootAsync` registration with full dependency injection, global by default, failing fast at bootstrap when no API key is configured.
- `IpregistryService` covering the whole SDK surface: single, batch, and origin lookups for IPs and ASNs, plus user agent parsing.
- Request enrichment through `IpregistryMiddleware` or `IpregistryInterceptor`: one lookup per request, memoized, readable synchronously with the `@Ipregistry()` parameter decorator.
- Country blocking (451) and threat/proxy/Tor blocking (403) with the self-contained `@BlockCountries()`, `@AllowCountries()`, and `@BlockThreats()` decorators, per route, per controller, or application-wide, plus `@SkipIpregistry()` to opt routes out.
- GDPR helper (`isEuVisitor`) based on the API's `location.in_eu` field, and a local `isBot` check that consumes no credits.
- Safe by default: fails open when Ipregistry is unreachable, never sends private IPs to the API, and never logs full IP addresses.
- Built-in caching through the SDK's LRU cache, so repeated visits from the same IP do not consume additional credits; pluggable with any `IpregistryCache` implementation.
- Trusted-proxy IP extraction presets for Cloudflare, Nginx, and Vercel, plus custom headers and extractors.
- First-class testing support: `FakeIpregistryClient` and fixture builders in `@ipregistry/nestjs/testing`.
- TypeScript-first, dual ESM/CJS, with the official SDK's response types re-exported.

## Getting started

You need an Ipregistry API key. Sign up at [https://ipregistry.co](https://ipregistry.co) to get one along with free lookups.

### Requirements

- NestJS 10 or newer
- Node.js 20 or newer

### Installation

```sh
npm install @ipregistry/nestjs
```

### Setup in three steps

Step 1: configure your API key, preferably through the environment:

```sh
# .env
IPREGISTRY_API_KEY=YOUR_API_KEY
```

Step 2: register the module once, in your root module:

```ts
import { Module } from '@nestjs/common'
import { IpregistryModule } from '@ipregistry/nestjs'

@Module({
    imports: [
        IpregistryModule.forRoot({
            fields: 'ip,location,security', // fetch only what you need
        }),
    ],
})
export class AppModule {}
```

Or asynchronously, for example with `@nestjs/config`:

```ts
IpregistryModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
        apiKey: config.getOrThrow('IPREGISTRY_API_KEY'),
        fields: 'ip,location,security',
    }),
})
```

Step 3: use the data. Inject the service anywhere, or enrich requests and read the context from a decorator:

```ts
import { Controller, Get, UseInterceptors } from '@nestjs/common'
import {
    Ipregistry,
    IpregistryInterceptor,
    IpregistryRequestContext,
} from '@ipregistry/nestjs'

@Controller()
export class HomeController {
    @Get()
    @UseInterceptors(IpregistryInterceptor)
    home(@Ipregistry() ipregistry: IpregistryRequestContext) {
        return {
            country: ipregistry.data?.location?.country?.name,
            city: ipregistry.data?.location?.city,
            isVpn: ipregistry.data?.security?.is_vpn,
        }
    }
}
```

## Using the service

`IpregistryService` is the main entry point and can be injected in any provider:

```ts
import { Injectable } from '@nestjs/common'
import { IpregistryService } from '@ipregistry/nestjs'

@Injectable()
export class SignupService {
    constructor(private readonly ipregistry: IpregistryService) {}

    async enrich(ip: string) {
        const response = await this.ipregistry.lookupIp(ip)
        return response.data
    }

    async enrichMany(ips: string[]) {
        const response = await this.ipregistry.batchLookupIps(ips)
        return response.data
    }
}
```

Available methods: `lookupIp`, `batchLookupIps`, `originLookupIp`, `lookupAsn`, `batchLookupAsns`, `originLookupAsn`, `parseUserAgents`, `lookupRequest`, `clientIp`, `isEuVisitor`, `isThreat`, and `isBot`. All lookup methods return the SDK's `ApiResponse<T>` envelope, which carries the consumed and remaining credits alongside the data. The raw `IpregistryClient` is also injectable when you need the SDK directly.

## Enriching requests

Two equivalent options attach Ipregistry data to incoming requests so handlers can read it synchronously. The lookup runs once per request, whatever the number of readers, and its result is cached across requests by IP.

With the interceptor, per handler, per controller, or globally (works on Express and Fastify):

```ts
import { APP_INTERCEPTOR } from '@nestjs/core'
import { IpregistryInterceptor } from '@ipregistry/nestjs'

@Module({
    providers: [{ provide: APP_INTERCEPTOR, useClass: IpregistryInterceptor }],
})
export class AppModule {}
```

With the middleware, from your module's `configure` method:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { IpregistryMiddleware } from '@ipregistry/nestjs'

export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(IpregistryMiddleware).forRoutes(HomeController)
    }
}
```

Downstream, read the context with the `@Ipregistry()` parameter decorator (shown above) or from any raw request object:

```ts
import { getIpregistryContext } from '@ipregistry/nestjs'

const context = getIpregistryContext(request)
```

The context is `{ ip, data, skipped?, error? }`: `data` is the SDK's `IpInfo` or null, `skipped` is set when no valid public client IP was available, and `error` is set when the lookup failed (the request still goes through by default, see [Error handling](#error-handling)).

`@Ipregistry()` also plucks single properties, like `@Ipregistry('data')` or `@Ipregistry('ip')`. The `@ClientIp()` parameter decorator injects the extracted client IP without any API call.

## Blocking countries

The `@BlockCountries()` and `@AllowCountries()` decorators (ISO 3166-1 alpha-2 codes, validated at route definition time) answer 451 Unavailable For Legal Reasons. They are self-contained and apply `IpregistryCountriesGuard` themselves, on a route or a whole controller:

```ts
import { Controller, Get } from '@nestjs/common'
import { AllowCountries, BlockCountries } from '@ipregistry/nestjs'

@Controller()
export class StoreController {
    @Get('checkout')
    @BlockCountries('KP', 'IR')
    checkout() {}

    @Get('fr-only')
    @AllowCountries('FR', 'BE')
    frOnly() {}
}
```

To block countries application-wide, set the module-level list and register the guard globally:

```ts
IpregistryModule.forRoot({ blockCountries: ['KP', 'IR'] }),
// ...
providers: [
    { provide: APP_GUARD, useClass: IpregistryCountriesGuard },
]
```

Route-level decorators override the module-level lists. Routes without any country configuration always pass, and visitors whose country cannot be determined pass too (fail-open).

## Blocking threats

The `@BlockThreats()` decorator answers 403 Forbidden for IPs flagged by Ipregistry, applying `IpregistryThreatsGuard` itself. By default the `is_threat`, `is_attacker`, and `is_abuser` signals are checked; anonymization signals (proxy, Tor, VPN, relay) are opt-in because they also match legitimate privacy-conscious users:

```ts
import { BlockThreats } from '@ipregistry/nestjs'

@Post('signup')
@BlockThreats({ tor: true, vpn: true })
signup() {}
```

Application-wide, with the module-level option and a global guard:

```ts
IpregistryModule.forRoot({ blockThreats: true }),
// ...
providers: [
    { provide: APP_GUARD, useClass: IpregistryThreatsGuard },
]
```

Blocking guards enrich the request as a side effect, so `@Ipregistry()` is populated for free in handlers behind a guard.

## Skipping routes

Opt individual routes or controllers out of a globally registered interceptor or guard with `@SkipIpregistry()`, typically for health checks, metrics endpoints, and webhooks:

```ts
import { SkipIpregistry } from '@ipregistry/nestjs'

@Get('health')
@SkipIpregistry()
health() {}
```

`IpregistryMiddleware` runs before routing and cannot see route metadata; scope it with `forRoutes()` and `exclude()` instead.

## GDPR and EU detection

```ts
import { isEuVisitor } from '@ipregistry/nestjs'

@Get()
@UseInterceptors(IpregistryInterceptor)
home(@Ipregistry() ipregistry: IpregistryRequestContext) {
    return { showConsentBanner: isEuVisitor(ipregistry) }
}
```

`isEuVisitor` answers false when the data is missing. Pass `{ assumeEu: true }` for a conservative stance that shows consent flows when in doubt.

## Caching

The SDK's in-memory LRU cache (2048 entries, 10-minute expiry) is enabled by default and shared across requests handled by the same process. Plug any `IpregistryCache` implementation (for example backed by Redis or Valkey) or disable caching entirely:

```ts
IpregistryModule.forRoot({ cache: new MyValkeyCache() })
IpregistryModule.forRoot({ cache: false })
```

On top of that, request enrichment is memoized per request: guards, interceptor, middleware, and decorators reading the same request share a single lookup.

## IP extraction behind proxies

By default (`ipSource: 'auto'`), the client IP is taken from `x-real-ip`, then the first `x-forwarded-for` entry, then the TCP socket address. Only trust headers your reverse proxy overwrites, otherwise clients can spoof them:

```ts
IpregistryModule.forRoot({ ipSource: 'cloudflare' }) // cf-connecting-ip
IpregistryModule.forRoot({ ipSource: 'socket' }) // direct exposure, headers ignored
IpregistryModule.forRoot({ ipSource: { header: 'x-client-ip' } })
IpregistryModule.forRoot({ ipSource: (request) => myExtract(request) })
```

Presets: `auto`, `cloudflare`, `nginx`, `vercel`, `forwarded-for`, and `socket`.

Private, loopback, and otherwise reserved client IPs are never sent to the API. During local development, set `developmentIp` (or `IPREGISTRY_DEVELOPMENT_IP`) to a fixed public IP so lookups return real data on localhost.

## Error handling

Request enrichment never throws: failed lookups produce a context whose `error` field carries a safe `{ code, message }` object, and the request goes through. Guards fail open the same way. To reject requests instead when Ipregistry cannot be reached, set `failOpen: false` and the enrichment middleware, interceptor, and guards answer 503.

Failures are logged through the NestJS logger (context `Ipregistry`) with anonymized IPs; plug your monitoring with the `onError` hook:

```ts
IpregistryModule.forRoot({
    onError: (error, anonymizedIp) => Sentry.captureException(error),
})
```

Direct `IpregistryService` lookup methods (e.g. `lookupIp`) throw the SDK's `ApiError` or `ClientError`, both re-exported by this package along with the `ErrorCode` enum and the `isApiError` type guard.

## Health checks

`IpregistryHealthIndicator` plugs into [`@nestjs/terminus`](https://docs.nestjs.com/recipes/terminus) without this package depending on it:

```ts
import { IpregistryHealthIndicator } from '@ipregistry/nestjs'

@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly ipregistry: IpregistryHealthIndicator,
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([() => this.ipregistry.isHealthy()])
    }
}
```

The probe looks up a fixed IP (default 8.8.8.8, configurable via `isHealthy('ipregistry', { probeIp })`) with `fields: 'ip'`. With the default cache the probe answers from cache most of the time, so it consumes at most one credit per cache TTL; outage detection is delayed by the same bound. When healthy, the result includes the remaining API credits when the API reports them, so monitoring can alert before lookups start failing.

## Configuration

All options for `IpregistryModule.forRoot` and `forRootAsync` factories. Explicit options take precedence over environment variables.

| Option                   | Environment variable        | Default                     | Description                                                                                      |
| ------------------------ | --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `allowCountries`         |                             | none                        | Only countries allowed application-wide by `IpregistryCountriesGuard` (alpha-2 codes).           |
| `apiKey`                 | `IPREGISTRY_API_KEY`        | none, required              | Your Ipregistry API key. The application fails fast at bootstrap when missing.                   |
| `baseUrl`                | `IPREGISTRY_BASE_URL`       | `https://api.ipregistry.co` | API base URL. Use the shorthand `eu` for the EU endpoint, or a full URL for private deployments. |
| `batchConcurrency`       |                             | 4                           | How many batch chunks are dispatched concurrently.                                               |
| `blockCountries`         |                             | none                        | Countries blocked application-wide by `IpregistryCountriesGuard` (alpha-2 codes).                |
| `blockThreats`           |                             | none                        | Threat signals blocked application-wide by `IpregistryThreatsGuard` (true or `ThreatOptions`).   |
| `cache`                  |                             | SDK `InMemoryCache`         | Any `IpregistryCache` implementation, or false to disable caching.                               |
| `client`                 |                             | built from options          | A pre-configured `IpregistryClient`, useful for tests.                                           |
| `developmentIp`          | `IPREGISTRY_DEVELOPMENT_IP` | none                        | Fixed public IP used instead of private or missing client IPs (localhost development).           |
| `failOpen`               |                             | true                        | Whether requests go through when the lookup fails, or are rejected with 503.                     |
| `fields`                 | `IPREGISTRY_FIELDS`         | full response               | Fields selected on request enrichment lookups, e.g. `ip,location,security`.                      |
| `hostname`               |                             | false                       | Whether enrichment lookups resolve the reverse DNS hostname.                                     |
| `ipSource`               |                             | `auto`                      | How the client IP is extracted: preset, `{ header }`, or custom extractor.                       |
| `isGlobal`               |                             | true                        | Whether the module is registered globally. Set false to import it per feature module.            |
| `maxBatchSize`           |                             | 1024                        | Maximum items per batch request; larger inputs are chunked automatically.                        |
| `maxRetries`             |                             | 1                           | Automatic retries. Kept low because enrichment sits on the request path.                         |
| `onError`                |                             | NestJS logger warning       | Hook called with the error and the anonymized client IP when enrichment fails.                   |
| `retryInterval`          |                             | 1000                        | Delay in milliseconds between automatic retries.                                                 |
| `retryOnServerError`     |                             | true                        | Whether to retry on 5xx responses.                                                               |
| `retryOnTooManyRequests` |                             | false                       | Whether to retry on 429 responses.                                                               |
| `timeout`                | `IPREGISTRY_TIMEOUT`        | 5000                        | Lookup timeout in milliseconds.                                                                  |

## Production checklist

- Select only the fields you need (`fields: 'ip,location,security'`): smaller payloads, faster lookups, and, depending on your plan, lower credit consumption.
- Set `ipSource` to match your actual proxy topology; the default `auto` trusts `x-real-ip` and `x-forwarded-for`, which is only safe when your proxy overwrites them. Use `socket` when the server is directly exposed.
- Keep the default cache (or plug a shared store) so repeated visitors do not consume credits; remember the per-request memoization already deduplicates readers.
- Decide on `failOpen`: the default lets traffic through during an Ipregistry outage; `failOpen: false` answers 503 instead. For blocking guards, fail-open means undetermined visitors pass.
- Wire `onError` to your monitoring, and consider `IpregistryHealthIndicator` for readiness dashboards and credit alerts.
- Exempt health checks, metrics endpoints, and webhooks with `@SkipIpregistry()` (or middleware `exclude()`), so probes never consume lookups.
- Misconfigurations (invalid country codes, private `developmentIp`, non-positive timeout) fail at bootstrap with a clear message, not at request time; a one-line sanitized configuration summary is logged at startup under the `Ipregistry` context.

## Testing your application

The `@ipregistry/nestjs/testing` entry point ships a drop-in fake client that answers from canned data, performs no HTTP request, consumes no credits, and records every call:

```ts
import { Test } from '@nestjs/testing'
import { IpregistryModule } from '@ipregistry/nestjs'
import { FakeIpregistryClient } from '@ipregistry/nestjs/testing'

const client = new FakeIpregistryClient({
    '1.2.3.4': { location: { country: { code: 'US' } } },
    '5.6.7.8': { security: { is_threat: true } },
    '9.9.9.9': new Error('simulated outage'),
    '*': {}, // fallback for any other IP
})

const moduleRef = await Test.createTestingModule({
    imports: [IpregistryModule.forRoot({ client })],
}).compile()

// ...exercise your routes...

expect(client.lookups).toHaveLength(1)
expect(client.lookups[0]).toMatchObject({ method: 'lookupIp' })
```

Fixture builders `createIpInfo`, `createUserAgent`, and `createAutonomousSystem` return complete, realistic objects deep-merged with your overrides.

## API reference

| Export                                                      | Description                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `IpregistryModule`                                          | The dynamic module: `forRoot(options)` and `forRootAsync({ useFactory, ... })`.  |
| `IpregistryService`                                         | Injectable service exposing the full SDK surface plus request-aware enrichment.  |
| `IpregistryClient`                                          | The underlying SDK client, injectable directly.                                  |
| `IpregistryInterceptor`                                     | Enriches HTTP requests; platform-agnostic; per handler, controller, or global.   |
| `IpregistryMiddleware`                                      | Enriches requests from `configure(consumer)`.                                    |
| `IpregistryCountriesGuard`, `IpregistryThreatsGuard`        | Blocking guards (451 and 403).                                                   |
| `@BlockCountries()`, `@AllowCountries()`, `@BlockThreats()` | Self-contained route and controller blocking decorators.                         |
| `@SkipIpregistry()`                                         | Opts a route or controller out of enrichment and blocking.                       |
| `@Ipregistry()`, `@ClientIp()`                              | Parameter decorators injecting the request context and the client IP.            |
| `getIpregistryContext(request)`                             | Reads the enriched context from any request object.                              |
| `IpregistryHealthIndicator`                                 | Health probe for `@nestjs/terminus`, reporting remaining credits.                |
| `isEuVisitor`, `isThreat`, `isBot`                          | Boolean helpers on `IpInfo` or request contexts; `isBot` needs no API call.      |
| `createIpExtractor`, `isPrivateIp`, `anonymizeIp`           | IP extraction utilities.                                                         |
| `IpregistryModuleOptions`, `IpregistryRequestContext`, ...  | All configuration and context types, plus re-exported SDK types (`IpInfo`, ...). |
| `FakeIpregistryClient`, `createIpInfo`, ...                 | Testing utilities, from `@ipregistry/nestjs/testing`.                            |

## Migrating from @ipregistry/client

The SDK keeps working as-is inside NestJS. This library adds the framework layer: dependency injection, bootstrap validation, request enrichment, guards, decorators, and testing fakes. To migrate, register `IpregistryModule` and replace manual client instantiation with injection of `IpregistryService` or `IpregistryClient`; the SDK response types are re-exported so imports can move to `@ipregistry/nestjs` without behavior changes.

## Other resources

- [Ipregistry documentation](https://ipregistry.co/docs)
- [JavaScript SDK](https://github.com/ipregistry/ipregistry-javascript)
- [Next.js integration](https://github.com/ipregistry/ipregistry-next)
- [Laravel integration](https://github.com/ipregistry/ipregistry-laravel)

## License

Apache 2.0. See [LICENSE.txt](LICENSE.txt).
