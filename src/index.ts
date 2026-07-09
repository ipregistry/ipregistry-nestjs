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

export {
    ALLOW_COUNTRIES_METADATA,
    BLOCK_COUNTRIES_METADATA,
    BLOCK_THREATS_METADATA,
    IPREGISTRY_CONTEXT_KEY,
} from './constants.js'
export { getIpregistryContext, setIpregistryContext } from './context.js'
export {
    isBot,
    isEuVisitor,
    isThreat,
    type IpInfoInput,
    type ThreatOptions,
} from './helpers.js'
export {
    anonymizeIp,
    createIpExtractor,
    isPrivateIp,
    isValidIp,
    sanitizeIp,
    type IpExtractor,
    type IpSource,
    type TrustedProxyPreset,
} from './ip.js'
export {
    ASYNC_OPTIONS_TYPE,
    IPREGISTRY_MODULE_OPTIONS,
    OPTIONS_TYPE,
} from './ipregistry.module-definition.js'
export {
    AllowCountries,
    BlockCountries,
    BlockThreats,
    ClientIp,
    Ipregistry,
} from './ipregistry.decorators.js'
export {
    IpregistryCountriesGuard,
    IpregistryThreatsGuard,
} from './ipregistry.guards.js'
export { IpregistryInterceptor } from './ipregistry.interceptor.js'
export { IpregistryMiddleware } from './ipregistry.middleware.js'
export { IpregistryModule } from './ipregistry.module.js'
export { IpregistryService } from './ipregistry.service.js'
export {
    createIpregistryClient,
    MissingApiKeyError,
    toErrorInfo,
    type IpregistryModuleOptions,
} from './options.js'
export type {
    IpregistryErrorInfo,
    IpregistryRequestContext,
    IpregistrySkipReason,
    RequestLike,
} from './types.js'
export { LIBRARY_VERSION } from './version.js'

// Re-export the SDK surface commonly needed alongside this library so most
// applications only depend on @ipregistry/nestjs.
export {
    ApiError,
    ClientError,
    InMemoryCache,
    IpregistryClient,
    LookupError,
    NoCache,
    UserAgents,
    type ApiResponse,
    type AutonomousSystem,
    type Carrier,
    type Company,
    type Connection,
    type Currency,
    type IpInfo,
    type IpregistryCache,
    type IpregistryClientOptions,
    type Location,
    type LookupOptions,
    type RequesterIpInfo,
    type Security,
    type TimeZone,
    type UserAgent,
} from '@ipregistry/client'
