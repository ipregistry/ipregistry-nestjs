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

import type { RequestLike } from './types.js'

/**
 * Presets naming the proxy headers that can be trusted to carry the real
 * client IP, depending on what sits in front of the NestJS server:
 *
 * - `auto`: `x-real-ip`, then the first `x-forwarded-for` entry, then the
 *   socket address. Safe behind a properly configured reverse proxy that
 *   overwrites these headers, and behind no proxy at all (socket fallback).
 * - `cloudflare`: `cf-connecting-ip` only.
 * - `vercel`: `x-real-ip`, then `x-vercel-forwarded-for`, then
 *   `x-forwarded-for`.
 * - `nginx`: `x-real-ip` (set via `proxy_set_header X-Real-IP $remote_addr`),
 *   then `x-forwarded-for`.
 * - `forwarded-for`: the first `x-forwarded-for` entry only.
 * - `socket`: the TCP socket address only, ignoring all headers. The right
 *   choice when the server is directly exposed to the internet, since
 *   clients can then send arbitrary proxy headers.
 */
export type TrustedProxyPreset =
    'auto' | 'cloudflare' | 'vercel' | 'nginx' | 'forwarded-for' | 'socket'

/**
 * A custom strategy for extracting the client IP from a request. Return null
 * when no trustworthy IP is available.
 */
export type IpExtractor = (request: RequestLike) => string | null

/**
 * The supported ways to configure IP extraction: a preset name, a single
 * trusted header, or a custom extractor function.
 */
export type IpSource = TrustedProxyPreset | { header: string } | IpExtractor

const PRESET_HEADERS: Record<TrustedProxyPreset, string[]> = {
    auto: ['x-real-ip', 'x-forwarded-for'],
    cloudflare: ['cf-connecting-ip'],
    vercel: ['x-real-ip', 'x-vercel-forwarded-for', 'x-forwarded-for'],
    nginx: ['x-real-ip', 'x-forwarded-for'],
    'forwarded-for': ['x-forwarded-for'],
    socket: [],
}

const SOCKET_FALLBACK_PRESETS: ReadonlySet<TrustedProxyPreset> = new Set([
    'auto',
    'socket',
])

function getHeader(request: RequestLike, name: string): string | null {
    const headers = request.headers ?? request.raw?.headers

    if (!headers) {
        return null
    }

    if (typeof (headers as Headers).get === 'function') {
        return (headers as Headers).get(name)
    }

    const value = (headers as Record<string, string | string[] | undefined>)[
        name
    ]

    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return typeof value === 'string' ? value : null
}

function getSocketAddress(request: RequestLike): string | null {
    return (
        request.socket?.remoteAddress ??
        request.raw?.socket?.remoteAddress ??
        null
    )
}

/**
 * Builds an `IpExtractor` from an `IpSource`. The returned extractor only
 * returns syntactically valid IP addresses; forwarded-for style lists are
 * reduced to their first (client) entry, and port suffixes, IPv6 brackets,
 * IPv4-mapped prefixes, and zone identifiers are stripped.
 */
export function createIpExtractor(source: IpSource = 'auto'): IpExtractor {
    if (typeof source === 'function') {
        return (request) => {
            const ip = source(request)
            const candidate = ip ? sanitizeIp(ip) : null
            return candidate && isValidIp(candidate) ? candidate : null
        }
    }

    const headerNames =
        typeof source === 'object'
            ? [source.header.toLowerCase()]
            : PRESET_HEADERS[source]

    const socketFallback =
        typeof source === 'string' && SOCKET_FALLBACK_PRESETS.has(source)

    return (request) => {
        for (const name of headerNames) {
            const value = getHeader(request, name)

            if (!value) {
                continue
            }

            const first = value.split(',')[0]
            const candidate = first ? sanitizeIp(first) : null

            if (candidate && isValidIp(candidate)) {
                return candidate
            }
        }

        if (socketFallback) {
            const address = getSocketAddress(request)
            const candidate = address ? sanitizeIp(address) : null

            if (candidate && isValidIp(candidate)) {
                return candidate
            }
        }

        return null
    }
}

/**
 * Normalizes a raw header or socket value into a bare IP address: trims
 * whitespace, removes IPv6 brackets, port suffixes ('1.2.3.4:8080',
 * '[::1]:8080'), IPv6 zone identifiers ('fe80::1%eth0'), and unwraps
 * IPv4-mapped IPv6 addresses ('::ffff:1.2.3.4').
 */
export function sanitizeIp(raw: string): string {
    let ip = raw.trim()

    const bracketMatch = ip.match(/^\[([^\]]+)\](?::\d+)?$/)
    if (bracketMatch) {
        ip = bracketMatch[1] as string
    } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
        ip = ip.slice(0, ip.lastIndexOf(':'))
    }

    const zoneIndex = ip.indexOf('%')
    if (zoneIndex !== -1) {
        ip = ip.slice(0, zoneIndex)
    }

    const mappedMatch = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
    if (mappedMatch) {
        ip = mappedMatch[1] as string
    }

    return ip
}

export function isValidIp(ip: string): boolean {
    return isValidIpv4(ip) || isValidIpv6(ip)
}

function isValidIpv4(ip: string): boolean {
    const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)

    if (!match) {
        return false
    }

    for (let i = 1; i <= 4; i++) {
        const octet = Number(match[i])
        if (octet > 255) {
            return false
        }
    }

    return true
}

function isValidIpv6(ip: string): boolean {
    if (!ip.includes(':') || ip.includes(':::')) {
        return false
    }

    const halves = ip.split('::')
    if (halves.length > 2) {
        return false
    }

    const splitGroups = (part: string) => (part === '' ? [] : part.split(':'))
    const groups = [
        ...splitGroups(halves[0] as string),
        ...(halves.length === 2 ? splitGroups(halves[1] as string) : []),
    ]

    let groupCount = groups.length
    const last = groups[groups.length - 1]

    if (last !== undefined && last.includes('.')) {
        if (!isValidIpv4(last)) {
            return false
        }
        groups.pop()
        groupCount += 1
    }

    for (const group of groups) {
        if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
            return false
        }
    }

    return halves.length === 2 ? groupCount <= 7 : groupCount === 8
}

/**
 * Whether the address belongs to a private, loopback, link-local, CGNAT, or
 * otherwise non-routable range. The Ipregistry API would reject these with
 * RESERVED_IP_ADDRESS, so the library skips the lookup entirely.
 */
export function isPrivateIp(ip: string): boolean {
    if (isValidIpv4(ip)) {
        return isPrivateIpv4(ip)
    }

    const lower = ip.toLowerCase()

    if (lower === '::' || lower === '::1') {
        return true
    }

    // IPv4-mapped addresses (::ffff:192.168.0.1)
    const mappedMatch = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
    if (mappedMatch) {
        return isPrivateIpv4(mappedMatch[1] as string)
    }

    // fc00::/7 (unique local) and fe80::/10 (link local)
    return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)
}

function isPrivateIpv4(ip: string): boolean {
    const octets = ip.split('.').map(Number)
    const [a, b] = octets as [number, number]

    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
    )
}

/**
 * Masks an IP address for logging: the last IPv4 octet is zeroed and IPv6
 * addresses are truncated to their first three groups. The library never
 * logs full IP addresses.
 */
export function anonymizeIp(ip: string): string {
    if (isValidIpv4(ip)) {
        return ip.replace(/\.\d{1,3}$/, '.0')
    }

    if (ip.includes(':')) {
        const groups = ip.split(':')
        return `${groups.slice(0, 3).join(':')}::`
    }

    return 'invalid'
}
