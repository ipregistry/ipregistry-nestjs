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
    Inject,
    Injectable,
    ServiceUnavailableException,
    type NestMiddleware,
} from '@nestjs/common'

import { IPREGISTRY_MODULE_OPTIONS } from './ipregistry.module-definition.js'
import { IpregistryService } from './ipregistry.service.js'
import type { IpregistryModuleOptions } from './options.js'
import type { RequestLike } from './types.js'

/**
 * Enriches incoming requests with Ipregistry data so route handlers can read
 * it synchronously through the `@Ipregistry()` parameter decorator or
 * `getIpregistryContext`. Apply it from your module's `configure` method:
 *
 * ```ts
 * export class AppModule implements NestModule {
 *     configure(consumer: MiddlewareConsumer) {
 *         consumer.apply(IpregistryMiddleware).forRoutes('*')
 *     }
 * }
 * ```
 *
 * With the default fail-open behavior a failed lookup lets the request
 * through with an error context; set `failOpen: false` to answer 503
 * instead. On Fastify, middleware requires the `middie` compatibility layer
 * NestJS sets up automatically; alternatively use `IpregistryInterceptor`,
 * which needs no platform support.
 */
@Injectable()
export class IpregistryMiddleware implements NestMiddleware {
    constructor(
        @Inject(IpregistryService)
        private readonly service: IpregistryService,
        @Inject(IPREGISTRY_MODULE_OPTIONS)
        private readonly options: IpregistryModuleOptions,
    ) {}

    async use(
        request: RequestLike,
        _response: unknown,
        next: (error?: unknown) => void,
    ): Promise<void> {
        const context = await this.service.lookupRequest(request)

        if (this.options.failOpen === false && context.error) {
            next(
                new ServiceUnavailableException(
                    'Service temporarily unavailable.',
                ),
            )
            return
        }

        next()
    }
}
