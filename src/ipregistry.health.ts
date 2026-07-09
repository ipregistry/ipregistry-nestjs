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

import { Inject, Injectable } from '@nestjs/common'

import { IpregistryService } from './ipregistry.service.js'
import { toErrorInfo } from './options.js'

/**
 * The result shape expected by `@nestjs/terminus` health checks. Declared
 * structurally so this library needs no dependency on terminus.
 */
export type IpregistryHealthIndicatorResult = Record<
    string,
    { status: 'up' | 'down'; [key: string]: unknown }
>

/**
 * Options for a single health probe.
 */
export interface IpregistryHealthCheckOptions {
    /**
     * The IP address looked up by the probe. Default: '8.8.8.8'. With the
     * default SDK cache the probe answers from cache most of the time, so
     * it consumes at most one credit per cache TTL (10 minutes); detection
     * of an outage is delayed by the same bound.
     */
    probeIp?: string
}

/**
 * A health indicator for the Ipregistry API, compatible with
 * `@nestjs/terminus` without depending on it:
 *
 * ```ts
 * @Controller('health')
 * export class HealthController {
 *     constructor(
 *         private readonly health: HealthCheckService,
 *         private readonly ipregistry: IpregistryHealthIndicator,
 *     ) {}
 *
 *     @Get()
 *     @HealthCheck()
 *     check() {
 *         return this.health.check([() => this.ipregistry.isHealthy()])
 *     }
 * }
 * ```
 *
 * When healthy, the result includes the remaining API credits when the API
 * reports them, which monitoring can alert on before lookups start failing.
 */
@Injectable()
export class IpregistryHealthIndicator {
    constructor(
        @Inject(IpregistryService)
        private readonly service: IpregistryService,
    ) {}

    async isHealthy(
        key = 'ipregistry',
        options?: IpregistryHealthCheckOptions,
    ): Promise<IpregistryHealthIndicatorResult> {
        try {
            const response = await this.service.lookupIp(
                options?.probeIp ?? '8.8.8.8',
                { fields: 'ip' },
            )

            return {
                [key]: {
                    status: 'up',
                    ...(response.credits.remaining !== null && {
                        creditsRemaining: response.credits.remaining,
                    }),
                },
            }
        } catch (error) {
            const info = toErrorInfo(error)

            return {
                [key]: {
                    status: 'down',
                    ...(info.code !== undefined && { code: info.code }),
                    message: info.message,
                },
            }
        }
    }
}
