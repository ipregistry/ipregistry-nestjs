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

import type { IpInfo } from '@ipregistry/client'

/**
 * The minimal request shape the library works with. It covers Express
 * requests, Fastify requests (whose `raw` property points to the underlying
 * Node request), and plain Node `IncomingMessage` objects, so every NestJS
 * HTTP adapter is supported.
 */
export interface RequestLike {
    headers: Headers | Record<string, string | string[] | undefined>
    socket?: { remoteAddress?: string | undefined }
    raw?: RequestLike
}

/**
 * Why no lookup data is available for a request.
 *
 * - `no-ip`: no valid, public client IP address could be extracted from the
 *   request and no `developmentIp` fallback applied.
 * - `not-enriched`: the request was never enriched, which usually means no
 *   Ipregistry middleware, interceptor, or guard ran for this route.
 */
export type IpregistrySkipReason = 'no-ip' | 'not-enriched'

/**
 * A safe, serializable description of a lookup failure.
 */
export interface IpregistryErrorInfo {
    /**
     * The Ipregistry API error code (e.g. 'INVALID_API_KEY') when the failure
     * came from the API, or a client-side code such as 'MISSING_API_KEY' or
     * 'CLIENT_ERROR'.
     */
    code?: string

    message: string
}

/**
 * The Ipregistry context attached to a request by the enrichment middleware,
 * interceptor, or guards, and read back with the `@Ipregistry()` parameter
 * decorator or `getIpregistryContext`.
 */
export interface IpregistryRequestContext {
    /**
     * The client IP address the lookup was performed for, or null when no
     * valid public IP could be extracted.
     */
    ip: string | null

    /**
     * The Ipregistry data for the client IP, or null when the lookup was
     * skipped or failed. Fields not selected via the `fields` option are
     * absent from the payload even though the `IpInfo` type declares them.
     */
    data: IpInfo | null

    /**
     * Set when the lookup was deliberately skipped.
     */
    skipped?: IpregistrySkipReason

    /**
     * Set when the lookup was attempted but failed. With the default
     * fail-open behavior the request still went through.
     */
    error?: IpregistryErrorInfo
}
