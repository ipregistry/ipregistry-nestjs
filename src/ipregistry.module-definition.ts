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

import { ConfigurableModuleBuilder } from '@nestjs/common'

import type { IpregistryModuleOptions } from './options.js'

export const {
    ConfigurableModuleClass,
    MODULE_OPTIONS_TOKEN: IPREGISTRY_MODULE_OPTIONS,
    OPTIONS_TYPE,
    ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<IpregistryModuleOptions>()
    .setClassMethodName('forRoot')
    .setExtras({ isGlobal: true }, (definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
    }))
    .build()

/**
 * The options accepted by `IpregistryModule.forRoot`, including the
 * `isGlobal` extra.
 */
export type IpregistryModuleRegisterOptions = typeof OPTIONS_TYPE

/**
 * The options accepted by `IpregistryModule.forRootAsync`
 * (`useFactory`/`useClass`/`useExisting`, `inject`, `imports`, plus the
 * `isGlobal` extra).
 */
export type IpregistryModuleAsyncOptions = typeof ASYNC_OPTIONS_TYPE
