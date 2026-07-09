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

/**
 * The property under which the resolved `IpregistryRequestContext` is
 * attached to the request object (like `request.user` for authentication).
 */
export const IPREGISTRY_CONTEXT_KEY = 'ipregistry'

/**
 * Metadata key set by the `@BlockCountries()` decorator and read by
 * `IpregistryCountriesGuard`.
 */
export const BLOCK_COUNTRIES_METADATA = 'ipregistry:block-countries'

/**
 * Metadata key set by the `@AllowCountries()` decorator and read by
 * `IpregistryCountriesGuard`.
 */
export const ALLOW_COUNTRIES_METADATA = 'ipregistry:allow-countries'

/**
 * Metadata key set by the `@BlockThreats()` decorator and read by
 * `IpregistryThreatsGuard`.
 */
export const BLOCK_THREATS_METADATA = 'ipregistry:block-threats'

/**
 * Metadata key set by the `@SkipIpregistry()` decorator and honored by
 * `IpregistryInterceptor`, `IpregistryCountriesGuard`, and
 * `IpregistryThreatsGuard`.
 */
export const SKIP_IPREGISTRY_METADATA = 'ipregistry:skip'
