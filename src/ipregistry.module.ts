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

import { Module } from '@nestjs/common'
import { IpregistryClient } from '@ipregistry/client'

import {
    ConfigurableModuleClass,
    IPREGISTRY_MODULE_OPTIONS,
} from './ipregistry.module-definition.js'
import {
    IpregistryCountriesGuard,
    IpregistryThreatsGuard,
} from './ipregistry.guards.js'
import { IpregistryHealthIndicator } from './ipregistry.health.js'
import { IpregistryInterceptor } from './ipregistry.interceptor.js'
import { IpregistryMiddleware } from './ipregistry.middleware.js'
import { IpregistryService } from './ipregistry.service.js'
import {
    createIpregistryClient,
    type IpregistryModuleOptions,
} from './options.js'

/**
 * The Ipregistry integration module. Register it once, synchronously or
 * asynchronously, and inject `IpregistryService` (or the raw
 * `IpregistryClient`) anywhere:
 *
 * ```ts
 * @Module({
 *     imports: [
 *         IpregistryModule.forRoot({ apiKey: process.env.IPREGISTRY_API_KEY }),
 *     ],
 * })
 * export class AppModule {}
 * ```
 *
 * ```ts
 * IpregistryModule.forRootAsync({
 *     inject: [ConfigService],
 *     useFactory: (config: ConfigService) => ({
 *         apiKey: config.getOrThrow('IPREGISTRY_API_KEY'),
 *     }),
 * })
 * ```
 *
 * The module is global by default (`isGlobal: false` to opt out), so
 * feature modules can use the service, guards, and decorators without
 * importing it again. The `IpregistryClient` is built at bootstrap and the
 * application fails fast when no API key is configured.
 */
@Module({
    providers: [
        {
            provide: IpregistryClient,
            useFactory: (options: IpregistryModuleOptions) =>
                createIpregistryClient(options),
            inject: [IPREGISTRY_MODULE_OPTIONS],
        },
        IpregistryService,
        IpregistryCountriesGuard,
        IpregistryThreatsGuard,
        IpregistryHealthIndicator,
        IpregistryInterceptor,
        IpregistryMiddleware,
    ],
    exports: [
        IPREGISTRY_MODULE_OPTIONS,
        IpregistryClient,
        IpregistryService,
        IpregistryCountriesGuard,
        IpregistryThreatsGuard,
        IpregistryHealthIndicator,
        IpregistryInterceptor,
        IpregistryMiddleware,
    ],
})
export class IpregistryModule extends ConfigurableModuleClass {}
