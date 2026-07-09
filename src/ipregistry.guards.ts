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
    ForbiddenException,
    HttpException,
    Inject,
    Injectable,
    ServiceUnavailableException,
    type CanActivate,
    type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import {
    ALLOW_COUNTRIES_METADATA,
    BLOCK_COUNTRIES_METADATA,
    BLOCK_THREATS_METADATA,
} from './constants.js'
import { isThreat, type ThreatOptions } from './helpers.js'
import { IPREGISTRY_MODULE_OPTIONS } from './ipregistry.module-definition.js'
import { IpregistryService } from './ipregistry.service.js'
import type { IpregistryModuleOptions } from './options.js'
import type { IpregistryRequestContext, RequestLike } from './types.js'

function metadataTargets(
    executionContext: ExecutionContext,
): [Parameters<Reflector['get']>[1], ...Parameters<Reflector['get']>[1][]] {
    return [executionContext.getHandler(), executionContext.getClass()]
}

/**
 * Whether the request goes through when no country/threat verdict could be
 * reached (lookup failed or returned no data). Fail-open by default; with
 * `failOpen: false` the request is rejected with 503.
 */
function passUndetermined(options: IpregistryModuleOptions): boolean {
    if (options.failOpen === false) {
        throw new ServiceUnavailableException(
            'Service temporarily unavailable.',
        )
    }

    return true
}

/**
 * Blocks or allows visitors by country, answering 451 Unavailable For Legal
 * Reasons. The country lists come from the `@BlockCountries()` and
 * `@AllowCountries()` decorators on the handler or controller, falling back
 * to the module-level `blockCountries` and `allowCountries` options. When a
 * global list is configured, the guard can be registered application-wide:
 *
 * ```ts
 * providers: [
 *     { provide: APP_GUARD, useClass: IpregistryCountriesGuard },
 * ]
 * ```
 *
 * Routes without any country configuration always pass. When the visitor's
 * country cannot be determined the guard fails open (or answers 503 with
 * `failOpen: false`).
 */
@Injectable()
export class IpregistryCountriesGuard implements CanActivate {
    constructor(
        @Inject(Reflector) private readonly reflector: Reflector,
        @Inject(IpregistryService)
        private readonly service: IpregistryService,
        @Inject(IPREGISTRY_MODULE_OPTIONS)
        private readonly options: IpregistryModuleOptions,
    ) {}

    async canActivate(executionContext: ExecutionContext): Promise<boolean> {
        if (executionContext.getType() !== 'http') {
            return true
        }

        const blocked =
            this.reflector.getAllAndOverride<string[] | undefined>(
                BLOCK_COUNTRIES_METADATA,
                metadataTargets(executionContext),
            ) ?? this.options.blockCountries?.map((code) => code.toUpperCase())

        const allowed =
            this.reflector.getAllAndOverride<string[] | undefined>(
                ALLOW_COUNTRIES_METADATA,
                metadataTargets(executionContext),
            ) ?? this.options.allowCountries?.map((code) => code.toUpperCase())

        if (!blocked?.length && !allowed?.length) {
            return true
        }

        const request = executionContext
            .switchToHttp()
            .getRequest<RequestLike>()
        const context = await this.service.lookupRequest(request)
        const code = countryCode(context)

        if (!code) {
            return passUndetermined(this.options)
        }

        if (
            blocked?.includes(code) ||
            (allowed !== undefined &&
                allowed.length > 0 &&
                !allowed.includes(code))
        ) {
            throw new HttpException('Unavailable For Legal Reasons', 451)
        }

        return true
    }
}

function countryCode(context: IpregistryRequestContext): string | null {
    const code = context.data?.location?.country?.code

    return typeof code === 'string' && code !== '' ? code.toUpperCase() : null
}

/**
 * Blocks visitors whose IP is flagged by Ipregistry, answering 403
 * Forbidden. The signals come from the `@BlockThreats()` decorator on the
 * handler or controller, falling back to the module-level `blockThreats`
 * option. When the option is set, the guard can be registered
 * application-wide:
 *
 * ```ts
 * IpregistryModule.forRoot({ blockThreats: { tor: true } }),
 * // ...
 * providers: [
 *     { provide: APP_GUARD, useClass: IpregistryThreatsGuard },
 * ]
 * ```
 *
 * Routes without any threat configuration always pass. When the lookup
 * fails the guard fails open (or answers 503 with `failOpen: false`).
 */
@Injectable()
export class IpregistryThreatsGuard implements CanActivate {
    constructor(
        @Inject(Reflector) private readonly reflector: Reflector,
        @Inject(IpregistryService)
        private readonly service: IpregistryService,
        @Inject(IPREGISTRY_MODULE_OPTIONS)
        private readonly options: IpregistryModuleOptions,
    ) {}

    async canActivate(executionContext: ExecutionContext): Promise<boolean> {
        if (executionContext.getType() !== 'http') {
            return true
        }

        const signals =
            this.reflector.getAllAndOverride<ThreatOptions | undefined>(
                BLOCK_THREATS_METADATA,
                metadataTargets(executionContext),
            ) ?? moduleThreatOptions(this.options)

        if (signals === undefined) {
            return true
        }

        const request = executionContext
            .switchToHttp()
            .getRequest<RequestLike>()
        const context = await this.service.lookupRequest(request)

        if (!context.data) {
            return passUndetermined(this.options)
        }

        if (isThreat(context, signals)) {
            throw new ForbiddenException('Forbidden')
        }

        return true
    }
}

function moduleThreatOptions(
    options: IpregistryModuleOptions,
): ThreatOptions | undefined {
    if (options.blockThreats === true) {
        return {}
    }

    if (options.blockThreats && typeof options.blockThreats === 'object') {
        return options.blockThreats
    }

    return undefined
}
