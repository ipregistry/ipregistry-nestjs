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

import { IPREGISTRY_CONTEXT_KEY } from './constants.js'
import type { IpregistryRequestContext, RequestLike } from './types.js'

/**
 * Reads the `IpregistryRequestContext` attached to a request by the
 * enrichment middleware, interceptor, or guards. Returns null when the
 * request was never enriched. Works with Express and Fastify request
 * objects as well as the underlying Node request.
 */
export function getIpregistryContext(
    request: RequestLike,
): IpregistryRequestContext | null {
    const direct = (request as unknown as Record<string, unknown>)[
        IPREGISTRY_CONTEXT_KEY
    ]

    if (direct) {
        return direct as IpregistryRequestContext
    }

    const raw = request.raw as Record<string, unknown> | undefined

    return (
        (raw?.[IPREGISTRY_CONTEXT_KEY] as
            IpregistryRequestContext | undefined) ?? null
    )
}

/**
 * Attaches an `IpregistryRequestContext` to a request object (and to its
 * underlying Node request when present) so it can be read back with
 * `getIpregistryContext` from any adapter's view of the request.
 */
export function setIpregistryContext(
    request: RequestLike,
    context: IpregistryRequestContext,
): IpregistryRequestContext {
    ;(request as unknown as Record<string, unknown>)[IPREGISTRY_CONTEXT_KEY] =
        context

    if (request.raw && typeof request.raw === 'object') {
        ;(request.raw as unknown as Record<string, unknown>)[
            IPREGISTRY_CONTEXT_KEY
        ] = context
    }

    return context
}
