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
    createParamDecorator,
    SetMetadata,
    type CustomDecorator,
    type ExecutionContext,
} from '@nestjs/common'

import {
    ALLOW_COUNTRIES_METADATA,
    BLOCK_COUNTRIES_METADATA,
    BLOCK_THREATS_METADATA,
} from './constants.js'
import { getIpregistryContext } from './context.js'
import type { ThreatOptions } from './helpers.js'
import { createIpExtractor } from './ip.js'
import type { IpregistryRequestContext, RequestLike } from './types.js'

function normalizeCountries(decorator: string, countries: string[]): string[] {
    if (countries.length === 0) {
        throw new TypeError(
            `@${decorator}() requires at least one ISO 3166-1 alpha-2 country code.`,
        )
    }

    return [
        ...new Set(
            countries.map((country) => {
                if (!/^[A-Za-z]{2}$/.test(country)) {
                    throw new TypeError(
                        `@${decorator}() received '${country}': expected an ` +
                            "ISO 3166-1 alpha-2 country code such as 'FR'.",
                    )
                }

                return country.toUpperCase()
            }),
        ),
    ]
}

/**
 * Blocks visitors from the given countries (ISO 3166-1 alpha-2 codes) on the
 * decorated route or controller, answering 451 Unavailable For Legal
 * Reasons. Requires `IpregistryCountriesGuard`:
 *
 * ```ts
 * @Get('checkout')
 * @UseGuards(IpregistryCountriesGuard)
 * @BlockCountries('KP', 'IR')
 * checkout() {}
 * ```
 *
 * Invalid codes throw at route definition time, not at request time.
 */
export const BlockCountries = (
    ...countries: string[]
): CustomDecorator<string> =>
    SetMetadata(
        BLOCK_COUNTRIES_METADATA,
        normalizeCountries('BlockCountries', countries),
    )

/**
 * Allows only visitors from the given countries (ISO 3166-1 alpha-2 codes)
 * on the decorated route or controller, answering 451 Unavailable For Legal
 * Reasons to everyone else. Requires `IpregistryCountriesGuard`.
 */
export const AllowCountries = (
    ...countries: string[]
): CustomDecorator<string> =>
    SetMetadata(
        ALLOW_COUNTRIES_METADATA,
        normalizeCountries('AllowCountries', countries),
    )

/**
 * Blocks visitors whose IP is flagged by Ipregistry on the decorated route
 * or controller, answering 403 Forbidden. Without arguments the default
 * signals are checked (threat, attacker, abuser); pass a `ThreatOptions`
 * object to include anonymization signals. Requires
 * `IpregistryThreatsGuard`:
 *
 * ```ts
 * @Post('signup')
 * @UseGuards(IpregistryThreatsGuard)
 * @BlockThreats({ tor: true, vpn: true })
 * signup() {}
 * ```
 */
export const BlockThreats = (
    options: ThreatOptions = {},
): CustomDecorator<string> => SetMetadata(BLOCK_THREATS_METADATA, options)

/**
 * Injects the request's `IpregistryRequestContext` into a route handler
 * parameter. The request must have been enriched first, by
 * `IpregistryMiddleware`, `IpregistryInterceptor`, or one of the blocking
 * guards; otherwise the context's `skipped` field is 'not-enriched':
 *
 * ```ts
 * @Get()
 * @UseInterceptors(IpregistryInterceptor)
 * home(@Ipregistry() ipregistry: IpregistryRequestContext) {
 *     return { country: ipregistry.data?.location?.country?.name }
 * }
 * ```
 */
export const Ipregistry = createParamDecorator(
    (
        _data: unknown,
        executionContext: ExecutionContext,
    ): IpregistryRequestContext => {
        const request = executionContext
            .switchToHttp()
            .getRequest<RequestLike>()

        return (
            getIpregistryContext(request) ?? {
                ip: null,
                data: null,
                skipped: 'not-enriched',
            }
        )
    },
)

const defaultExtractor = createIpExtractor('auto')

/**
 * Injects the client IP address (or null) into a route handler parameter.
 * No API call is made. On enriched requests this is the IP the lookup ran
 * for, extracted with the configured `ipSource`; on non-enriched requests
 * it falls back to the default 'auto' extraction.
 */
export const ClientIp = createParamDecorator(
    (_data: unknown, executionContext: ExecutionContext): string | null => {
        const request = executionContext
            .switchToHttp()
            .getRequest<RequestLike>()
        const context = getIpregistryContext(request)

        if (context?.ip) {
            return context.ip
        }

        return defaultExtractor(request)
    },
)
