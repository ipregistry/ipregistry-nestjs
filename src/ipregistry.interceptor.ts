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
    type CallHandler,
    type ExecutionContext,
    type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Observable } from 'rxjs'

import { isIpregistrySkipped } from './ipregistry.guards.js'
import { IPREGISTRY_MODULE_OPTIONS } from './ipregistry.module-definition.js'
import { IpregistryService } from './ipregistry.service.js'
import type { IpregistryModuleOptions } from './options.js'
import type { RequestLike } from './types.js'

/**
 * Enriches incoming HTTP requests with Ipregistry data, like
 * `IpregistryMiddleware` but as an interceptor: it works identically on
 * every platform (Express, Fastify) and can be applied per handler, per
 * controller, or globally:
 *
 * ```ts
 * providers: [
 *     { provide: APP_INTERCEPTOR, useClass: IpregistryInterceptor },
 * ]
 * ```
 *
 * Non-HTTP execution contexts (WebSockets, microservices, GraphQL) pass
 * through untouched, and so do routes decorated with `@SkipIpregistry()`.
 */
@Injectable()
export class IpregistryInterceptor implements NestInterceptor {
    constructor(
        @Inject(Reflector) private readonly reflector: Reflector,
        @Inject(IpregistryService)
        private readonly service: IpregistryService,
        @Inject(IPREGISTRY_MODULE_OPTIONS)
        private readonly options: IpregistryModuleOptions,
    ) {}

    async intercept(
        executionContext: ExecutionContext,
        next: CallHandler,
    ): Promise<Observable<unknown>> {
        if (
            executionContext.getType() === 'http' &&
            !isIpregistrySkipped(this.reflector, executionContext)
        ) {
            const request = executionContext
                .switchToHttp()
                .getRequest<RequestLike>()
            const context = await this.service.lookupRequest(request)

            if (this.options.failOpen === false && context.error) {
                throw new ServiceUnavailableException(
                    'Service temporarily unavailable.',
                )
            }
        }

        return next.handle()
    }
}
