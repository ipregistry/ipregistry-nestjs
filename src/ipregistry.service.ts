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

import { Inject, Injectable, Logger } from '@nestjs/common'
import {
    IpregistryClient,
    type ApiResponse,
    type AutonomousSystem,
    type IpInfo,
    type LookupError,
    type LookupOptions,
    type RequesterAutonomousSystem,
    type RequesterIpInfo,
    type UserAgent,
} from '@ipregistry/client'

import { setIpregistryContext } from './context.js'
import {
    isBot,
    isEuVisitor,
    isThreat,
    type IpInfoInput,
    type ThreatOptions,
} from './helpers.js'
import {
    anonymizeIp,
    createIpExtractor,
    isPrivateIp,
    isValidIp,
    type IpExtractor,
} from './ip.js'
import { IPREGISTRY_MODULE_OPTIONS } from './ipregistry.module-definition.js'
import { toErrorInfo, type IpregistryModuleOptions } from './options.js'
import type { IpregistryRequestContext, RequestLike } from './types.js'

/**
 * The main entry point for Ipregistry lookups in a NestJS application.
 * Exposes the full SDK surface (single, batch, and origin lookups for IPs
 * and ASNs, user agent parsing) plus request-aware enrichment that extracts
 * the client IP, skips private addresses, memoizes the result per request,
 * and never throws.
 */
@Injectable()
export class IpregistryService {
    private readonly logger = new Logger('Ipregistry')
    private readonly extractor: IpExtractor
    private readonly contexts = new WeakMap<
        object,
        Promise<IpregistryRequestContext>
    >()

    constructor(
        @Inject(IpregistryClient) readonly client: IpregistryClient,
        @Inject(IPREGISTRY_MODULE_OPTIONS)
        private readonly options: IpregistryModuleOptions,
    ) {
        this.extractor = createIpExtractor(options.ipSource)
    }

    /**
     * Looks up Ipregistry data for a single IP address. Results are served
     * from the configured cache when possible.
     */
    lookupIp(
        ip: string,
        options?: LookupOptions,
    ): Promise<ApiResponse<IpInfo>> {
        return this.client.lookupIp(ip, options)
    }

    /**
     * Looks up Ipregistry data for multiple IP addresses in as few API
     * requests as possible. Inputs larger than the configured batch size are
     * chunked automatically. Per-item failures are returned as
     * `LookupError` entries instead of failing the whole batch.
     */
    batchLookupIps(
        ips: string[],
        options?: LookupOptions,
    ): Promise<ApiResponse<(IpInfo | LookupError)[]>> {
        return this.client.batchLookupIps(ips, options)
    }

    /**
     * Looks up Ipregistry data for the IP the API sees as the caller, which
     * is this server's public IP. Never cached.
     */
    originLookupIp(
        options?: LookupOptions,
    ): Promise<ApiResponse<RequesterIpInfo>> {
        return this.client.originLookupIp(options)
    }

    /**
     * Looks up an Autonomous System by number.
     */
    lookupAsn(
        asn: number,
        options?: LookupOptions,
    ): Promise<ApiResponse<AutonomousSystem>> {
        return this.client.lookupAsn(asn, options)
    }

    /**
     * Looks up multiple Autonomous Systems by number.
     */
    batchLookupAsns(
        asns: number[],
        options?: LookupOptions,
    ): Promise<ApiResponse<(AutonomousSystem | LookupError)[]>> {
        return this.client.batchLookupAsns(asns, options)
    }

    /**
     * Looks up the Autonomous System that announces this server's public IP.
     * Never cached.
     */
    originLookupAsn(
        options?: LookupOptions,
    ): Promise<ApiResponse<RequesterAutonomousSystem>> {
        return this.client.originLookupAsn(options)
    }

    /**
     * Parses user agent strings through the Ipregistry API. For a quick
     * local bot check that needs no API call, see `isBot`.
     */
    parseUserAgents(
        userAgents: string[],
        options?: LookupOptions,
    ): Promise<ApiResponse<UserAgent[]>> {
        return this.client.parseUserAgents(userAgents, options)
    }

    /**
     * Extracts the client IP address from a request using the configured
     * `ipSource`, without any API call. Returns null when no syntactically
     * valid IP is available. The result may be a private address (e.g. on
     * localhost); request lookups filter those out separately.
     */
    clientIp(request: RequestLike): string | null {
        return this.extractor(request)
    }

    /**
     * Resolves Ipregistry data for the request's client IP. The result is
     * memoized on the request: concurrent and subsequent calls for the same
     * request share a single lookup, and the resolved context is attached to
     * the request object for the `@Ipregistry()` parameter decorator.
     *
     * This method never throws. Failed lookups produce a context whose
     * `error` field is set; skipped lookups (no valid public client IP) set
     * the `skipped` field.
     */
    lookupRequest(request: RequestLike): Promise<IpregistryRequestContext> {
        const target = (request.raw ?? request) as object
        let pending = this.contexts.get(target)

        if (!pending) {
            pending = this.resolveContext(request)
            this.contexts.set(target, pending)
        }

        return pending
    }

    /**
     * Whether the visitor is located in the European Union. See the
     * standalone `isEuVisitor` helper.
     */
    isEuVisitor(input: IpInfoInput, options?: { assumeEu?: boolean }): boolean {
        return isEuVisitor(input, options)
    }

    /**
     * Whether Ipregistry flags the IP as a threat. See the standalone
     * `isThreat` helper.
     */
    isThreat(input: IpInfoInput, options?: ThreatOptions): boolean {
        return isThreat(input, options)
    }

    /**
     * Whether the request comes from a bot or crawler, based on its user
     * agent. No API call. See the standalone `isBot` helper.
     */
    isBot(input: Parameters<typeof isBot>[0]): boolean {
        return isBot(input)
    }

    private async resolveContext(
        request: RequestLike,
    ): Promise<IpregistryRequestContext> {
        let ip = this.extractor(request)

        if (!ip || isPrivateIp(ip)) {
            const developmentIp =
                this.options.developmentIp ??
                process.env.IPREGISTRY_DEVELOPMENT_IP

            ip =
                developmentIp && isValidIp(developmentIp) ? developmentIp : null
        }

        if (!ip) {
            return setIpregistryContext(request, {
                ip: null,
                data: null,
                skipped: 'no-ip',
            })
        }

        const lookupOptions: LookupOptions = {}
        const fields = this.options.fields ?? process.env.IPREGISTRY_FIELDS

        if (fields) {
            lookupOptions.fields = fields
        }

        if (this.options.hostname) {
            lookupOptions.hostname = true
        }

        try {
            const response = await this.client.lookupIp(ip, lookupOptions)

            return setIpregistryContext(request, {
                ip,
                data: response.data,
            })
        } catch (error) {
            this.reportError(error, ip)

            return setIpregistryContext(request, {
                ip,
                data: null,
                error: toErrorInfo(error),
            })
        }
    }

    private reportError(error: unknown, ip: string | null): void {
        const anonymized = ip ? anonymizeIp(ip) : null

        if (this.options.onError) {
            try {
                this.options.onError(error, anonymized)
            } catch {
                // Never let a monitoring hook break request handling.
            }
            return
        }

        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(
            `Lookup failed for ${anonymized ?? 'unknown IP'}: ${message}`,
        )
    }
}
