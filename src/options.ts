/*
 * Copyright 2026 Ipregistry (https://ipregistry.co).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    ApiError,
    ClientError,
    InMemoryCache,
    IpregistryClient,
    NoCache,
    type IpregistryCache,
} from '@ipregistry/client'

import type { ThreatOptions } from './helpers.js'
import type { IpSource } from './ip.js'
import type { IpregistryErrorInfo } from './types.js'

/**
 * Options accepted by `IpregistryModule.forRoot` and returned by
 * `IpregistryModule.forRootAsync` factories. Connection settings can also be
 * provided through environment variables, which is the recommended way to
 * keep the API key out of the codebase:
 *
 * - `IPREGISTRY_API_KEY`
 * - `IPREGISTRY_BASE_URL` (accepts the 'eu' shorthand)
 * - `IPREGISTRY_TIMEOUT` (milliseconds)
 * - `IPREGISTRY_FIELDS` (comma-separated field selection)
 * - `IPREGISTRY_DEVELOPMENT_IP`
 *
 * Explicit options take precedence over environment variables.
 */
export interface IpregistryModuleOptions {
    /**
     * The Ipregistry API key. Defaults to `process.env.IPREGISTRY_API_KEY`.
     * The module fails fast at bootstrap when neither is set.
     */
    apiKey?: string

    /**
     * The Ipregistry API base URL, or the shorthand 'eu' for the European
     * Union endpoint. Defaults to `process.env.IPREGISTRY_BASE_URL`, then to
     * the default endpoint.
     */
    baseUrl?: string

    /**
     * The lookup timeout in milliseconds. Defaults to
     * `process.env.IPREGISTRY_TIMEOUT`, then 5000.
     */
    timeout?: number

    /**
     * The maximum number of automatic retries. Defaults to 1: enrichment
     * sits on the request path, so long backoff loops would stall responses,
     * but a single retry still absorbs transient failures. Raise it for
     * batch or background workloads.
     */
    maxRetries?: number

    /**
     * The delay in milliseconds between automatic retries. Defaults to the
     * SDK value (1000).
     */
    retryInterval?: number

    /**
     * Whether to retry when the API answers with a server error (5xx).
     * Defaults to the SDK value (true).
     */
    retryOnServerError?: boolean

    /**
     * Whether to retry when the API answers with 429 Too Many Requests.
     * Defaults to the SDK value (false).
     */
    retryOnTooManyRequests?: boolean

    /**
     * The maximum number of items per batch request. Defaults to the SDK
     * value (1024). Larger inputs are chunked automatically.
     */
    maxBatchSize?: number

    /**
     * How many batch chunks are dispatched concurrently. Defaults to the SDK
     * value (4).
     */
    batchConcurrency?: number

    /**
     * The cache used to avoid repeated lookups for the same IP. Defaults to
     * the SDK's `InMemoryCache` (2048 entries, 10-minute expiry) shared
     * across requests handled by the same process. Pass any
     * `IpregistryCache` implementation to plug a custom store (e.g. backed
     * by Redis or Valkey), or false to disable caching.
     */
    cache?: IpregistryCache | false

    /**
     * A pre-configured `IpregistryClient` to use instead of building one
     * from the options above. Useful for tests (see
     * `FakeIpregistryClient` in `@ipregistry/nestjs/testing`) and advanced
     * setups.
     */
    client?: IpregistryClient

    /**
     * The fields selected on request enrichment lookups (e.g.
     * 'location,security'), reducing payload size and, depending on your
     * plan, credit consumption. Defaults to `process.env.IPREGISTRY_FIELDS`,
     * then to the full response. Explicit per-call options passed to
     * `IpregistryService` methods are not affected.
     */
    fields?: string

    /**
     * Whether request enrichment lookups resolve the reverse DNS hostname.
     * Default: false.
     */
    hostname?: boolean

    /**
     * How the client IP is extracted from incoming requests: a trusted
     * proxy preset, a single trusted header, or a custom extractor. Only
     * trust headers your proxy overwrites, otherwise clients can spoof
     * them. Default: 'auto'.
     */
    ipSource?: IpSource

    /**
     * A fixed public IP address used instead of private or missing client
     * IPs, so lookups return real data during local development. Defaults
     * to `process.env.IPREGISTRY_DEVELOPMENT_IP`, then to none (private IPs
     * skip the lookup and are never sent to the API).
     */
    developmentIp?: string

    /**
     * Whether requests go through when the lookup fails (true, the default)
     * or are rejected with 503 Service Unavailable by the enrichment
     * middleware, interceptor, and guards (false). An Ipregistry outage
     * never locks users out with the default.
     */
    failOpen?: boolean

    /**
     * Countries blocked application-wide by `IpregistryCountriesGuard`
     * (ISO 3166-1 alpha-2 codes) when a route carries no
     * `@BlockCountries()` metadata. Combine with a global guard
     * registration (APP_GUARD) to block countries for every route.
     */
    blockCountries?: string[]

    /**
     * The only countries allowed application-wide by
     * `IpregistryCountriesGuard` (ISO 3166-1 alpha-2 codes) when a route
     * carries no `@AllowCountries()` metadata.
     */
    allowCountries?: string[]

    /**
     * Threat signals blocked application-wide by `IpregistryThreatsGuard`
     * when a route carries no `@BlockThreats()` metadata. Pass true for the
     * default signals (threat, attacker, abuser) or a `ThreatOptions`
     * object to include proxy/Tor/VPN/relay signals.
     */
    blockThreats?: boolean | ThreatOptions

    /**
     * Called when a request enrichment lookup fails, with the thrown error
     * and the anonymized client IP. Defaults to logging a warning through
     * the NestJS logger. The library never logs full IP addresses.
     */
    onError?: (error: unknown, anonymizedIp: string | null) => void
}

/**
 * A `ClientError` raised at module bootstrap when no API key is configured.
 * Carries the same code as the API's MISSING_API_KEY error so error handling
 * can treat both alike.
 */
export class MissingApiKeyError extends ClientError {
    public readonly code = 'MISSING_API_KEY'

    constructor() {
        super(
            'Missing Ipregistry API key: set the IPREGISTRY_API_KEY ' +
                'environment variable or pass the apiKey option to ' +
                'IpregistryModule.forRoot.',
        )
        Object.setPrototypeOf(this, new.target.prototype)
    }
}

/**
 * Builds the `IpregistryClient` provided by `IpregistryModule`, merging
 * explicit options with environment variables.
 */
export function createIpregistryClient(
    options: IpregistryModuleOptions = {},
): IpregistryClient {
    if (options.client) {
        return options.client
    }

    const apiKey = options.apiKey ?? process.env.IPREGISTRY_API_KEY

    if (!apiKey) {
        throw new MissingApiKeyError()
    }

    const timeoutFromEnv = Number(process.env.IPREGISTRY_TIMEOUT)

    return new IpregistryClient({
        apiKey,
        baseUrl: options.baseUrl ?? process.env.IPREGISTRY_BASE_URL,
        timeout:
            options.timeout ??
            (Number.isFinite(timeoutFromEnv) && timeoutFromEnv > 0
                ? timeoutFromEnv
                : 5000),
        maxRetries: options.maxRetries ?? 1,
        retryInterval: options.retryInterval,
        retryOnServerError: options.retryOnServerError,
        retryOnTooManyRequests: options.retryOnTooManyRequests,
        maxBatchSize: options.maxBatchSize,
        batchConcurrency: options.batchConcurrency,
        cache:
            options.cache === false
                ? new NoCache()
                : (options.cache ?? new InMemoryCache()),
    })
}

/**
 * Converts any thrown value into the serializable error info attached to the
 * request context. Never includes stack traces or request details.
 */
export function toErrorInfo(error: unknown): IpregistryErrorInfo {
    if (error instanceof ApiError) {
        return { code: error.code, message: error.message }
    }

    if (error instanceof MissingApiKeyError) {
        return { code: error.code, message: error.message }
    }

    if (error instanceof Error) {
        return { code: 'CLIENT_ERROR', message: error.message }
    }

    return { code: 'CLIENT_ERROR', message: String(error) }
}
