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
    IpregistryClient,
    RegionalInternetRegistry,
    AsType,
    type ApiResponse,
    type AutonomousSystem,
    type IpInfo,
    type LookupError,
    type RequesterAutonomousSystem,
    type RequesterIpInfo,
    type UserAgent,
} from '@ipregistry/client'

/**
 * A recursively partial version of a response type, accepted by the fixture
 * builders and `FakeIpregistryClient` canned responses.
 */
export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends (infer E)[]
        ? DeepPartial<E>[]
        : T[K] extends object | null
          ? DeepPartial<NonNullable<T[K]>> | null
          : T[K]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype
    )
}

function deepMerge<T>(base: T, overrides: DeepPartial<T> | undefined): T {
    if (overrides === undefined) {
        return base
    }

    if (!isPlainObject(base) || !isPlainObject(overrides)) {
        return overrides as T
    }

    const result: Record<string, unknown> = { ...base }

    for (const [key, value] of Object.entries(overrides)) {
        const current = result[key]

        result[key] =
            isPlainObject(current) && isPlainObject(value)
                ? deepMerge(current, value)
                : value
    }

    return result as T
}

/**
 * Builds a complete, realistic `IpInfo` fixture (a French residential IP in
 * Paris with all security flags off), deep-merged with the given overrides:
 *
 * ```ts
 * createIpInfo({ ip: '1.2.3.4', location: { country: { code: 'US' } } })
 * createIpInfo({ security: { is_threat: true } })
 * ```
 */
export function createIpInfo(overrides: DeepPartial<IpInfo> = {}): IpInfo {
    const base: IpInfo = {
        ip: '82.64.11.19',
        type: 'IPv4',
        hostname: null,
        carrier: {
            name: null,
            mcc: null,
            mnc: null,
        },
        company: {
            domain: 'free.fr',
            name: 'Free',
            type: 'isp',
        },
        connection: {
            asn: 12322,
            domain: 'free.fr',
            organization: 'Free SAS',
            route: '82.64.0.0/14',
            type: 'isp',
        },
        currency: {
            code: 'EUR',
            name: 'Euro',
            name_native: 'euro',
            plural: 'euros',
            plural_native: 'euros',
            symbol: '€',
            symbol_native: '€',
            format: {
                decimal_separator: ',',
                group_separator: ' ',
                negative: { prefix: '-', suffix: ' €' },
                positive: { prefix: '', suffix: ' €' },
            },
        },
        location: {
            continent: { code: 'EU', name: 'Europe' },
            country: {
                area: 551500,
                borders: ['AD', 'BE', 'CH', 'DE', 'ES', 'IT', 'LU', 'MC'],
                calling_code: '33',
                capital: 'Paris',
                code: 'FR',
                name: 'France',
                population: 68042591,
                population_density: 123.38,
                flag: {
                    emoji: '🇫🇷',
                    emoji_unicode: 'U+1F1EB U+1F1F7',
                    emojitwo: 'https://cdn.ipregistry.co/flags/emojitwo/fr.svg',
                    noto: 'https://cdn.ipregistry.co/flags/noto/fr.png',
                    twemoji: 'https://cdn.ipregistry.co/flags/twemoji/fr.svg',
                    wikimedia:
                        'https://cdn.ipregistry.co/flags/wikimedia/fr.svg',
                },
                languages: [{ code: 'fr', name: 'French', native: 'français' }],
                tld: '.fr',
            },
            region: { code: 'FR-IDF', name: 'Île-de-France' },
            city: 'Paris',
            postal: '75001',
            latitude: 48.8566,
            longitude: 2.3522,
            language: {
                code: 'fr',
                name: 'French',
                native: 'français',
            },
            in_eu: true,
        },
        security: {
            is_abuser: false,
            is_attacker: false,
            is_bogon: false,
            is_cloud_provider: false,
            is_proxy: false,
            is_relay: false,
            is_tor: false,
            is_tor_exit: false,
            is_anonymous: false,
            is_threat: false,
            is_vpn: false,
        },
        time_zone: {
            id: 'Europe/Paris',
            abbreviation: 'CET',
            current_time: '2026-01-01T12:00:00+01:00',
            name: 'Central European Time',
            offset: 3600,
            in_daylight_saving: false,
        },
    }

    return deepMerge(base, overrides)
}

/**
 * Builds a complete `UserAgent` fixture, deep-merged with the overrides.
 */
export function createUserAgent(
    overrides: DeepPartial<UserAgent> = {},
): UserAgent {
    const base: UserAgent = {
        header: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        name: 'Chrome',
        type: 'browser',
        version: '126.0.0.0',
        version_major: '126',
        device: { brand: null, name: 'Linux Desktop', type: 'desktop' },
        engine: {
            name: 'Blink',
            type: 'browser',
            version: '126.0.0.0',
            version_major: '126',
        },
        os: { name: 'Linux', type: 'desktop', version: null },
    }

    return deepMerge(base, overrides)
}

/**
 * Builds a complete `AutonomousSystem` fixture, deep-merged with the
 * overrides.
 */
export function createAutonomousSystem(
    overrides: DeepPartial<AutonomousSystem> = {},
): AutonomousSystem {
    const base: AutonomousSystem = {
        allocated: '1997-05-22',
        asn: 12322,
        country_code: 'FR',
        domain: 'free.fr',
        name: 'Free SAS',
        prefixes: {
            ipv4_count: 1,
            ipv6_count: 0,
            ipv4: [
                {
                    cidr: '82.64.0.0/14',
                    country_code: 'FR',
                    network_name: 'FR-PROXAD-ADSL',
                    organization: 'Free SAS',
                    prefix: '82.64.0.0',
                    registry: RegionalInternetRegistry.RIPE_NCC,
                    size: 262144,
                    status: 'allocated',
                },
            ],
            ipv6: [],
        },
        relationships: { downstreams: [], peers: [], upstreams: [] },
        registry: RegionalInternetRegistry.RIPE_NCC,
        type: AsType.ISP,
        updated: '2026-01-01',
    }

    return deepMerge(base, overrides)
}

function respond<T>(data: T): ApiResponse<T> {
    return {
        credits: { consumed: 1, remaining: null },
        data,
        throttling: null,
    }
}

/**
 * A call recorded by `FakeIpregistryClient`.
 */
export interface RecordedLookup {
    method:
        | 'lookupIp'
        | 'batchLookupIps'
        | 'originLookupIp'
        | 'lookupAsn'
        | 'batchLookupAsns'
        | 'originLookupAsn'
        | 'parseUserAgents'
    args: unknown[]
}

/**
 * Canned responses for `FakeIpregistryClient`, keyed by IP address. The
 * special keys '*' (fallback for any IP) and 'origin' (origin lookups) are
 * supported. Map a key to an `Error` to simulate a failed lookup.
 */
export type FakeResponses = Record<string, DeepPartial<IpInfo> | Error>

/**
 * A drop-in `IpregistryClient` replacement that answers from canned data,
 * performs no HTTP request, consumes no credits, and records every call:
 *
 * ```ts
 * const client = new FakeIpregistryClient({
 *     '1.2.3.4': { location: { country: { code: 'US' } } },
 *     '5.6.7.8': { security: { is_threat: true } },
 *     '9.9.9.9': new ClientError('boom'),
 *     '*': {},
 * })
 *
 * Test.createTestingModule({
 *     imports: [IpregistryModule.forRoot({ client })],
 * })
 *
 * expect(client.lookups).toHaveLength(1)
 * ```
 */
export class FakeIpregistryClient extends IpregistryClient {
    /**
     * Every call made against the fake, in order.
     */
    readonly lookups: RecordedLookup[] = []

    constructor(private readonly responses: FakeResponses = {}) {
        super({ apiKey: 'fake' })
    }

    private resolve(key: string): IpInfo {
        const canned = this.responses[key] ?? this.responses['*']

        if (canned instanceof Error) {
            throw canned
        }

        const withIp: DeepPartial<IpInfo> =
            key === 'origin' || key === '*'
                ? (canned ?? {})
                : { ip: key, ...(canned ?? {}) }

        return createIpInfo(withIp)
    }

    override async lookupIp(
        ip: string,
        ...options: unknown[]
    ): Promise<ApiResponse<IpInfo>> {
        this.lookups.push({ method: 'lookupIp', args: [ip, ...options] })
        return respond(this.resolve(ip))
    }

    override async batchLookupIps(
        ips: string[],
        ...options: unknown[]
    ): Promise<ApiResponse<(IpInfo | LookupError)[]>> {
        this.lookups.push({ method: 'batchLookupIps', args: [ips, ...options] })
        return respond(ips.map((ip) => this.resolve(ip)))
    }

    override async originLookupIp(
        ...options: unknown[]
    ): Promise<ApiResponse<RequesterIpInfo>> {
        this.lookups.push({ method: 'originLookupIp', args: [...options] })
        return respond({
            ...this.resolve('origin'),
            user_agent: createUserAgent(),
        })
    }

    override async lookupAsn(
        asn: number,
        ...options: unknown[]
    ): Promise<ApiResponse<AutonomousSystem>> {
        this.lookups.push({ method: 'lookupAsn', args: [asn, ...options] })
        return respond(createAutonomousSystem({ asn }))
    }

    override async batchLookupAsns(
        asns: number[],
        ...options: unknown[]
    ): Promise<ApiResponse<(AutonomousSystem | LookupError)[]>> {
        this.lookups.push({
            method: 'batchLookupAsns',
            args: [asns, ...options],
        })
        return respond(asns.map((asn) => createAutonomousSystem({ asn })))
    }

    override async originLookupAsn(
        ...options: unknown[]
    ): Promise<ApiResponse<RequesterAutonomousSystem>> {
        this.lookups.push({ method: 'originLookupAsn', args: [...options] })
        return respond(createAutonomousSystem())
    }

    override async parseUserAgents(
        ...args: unknown[]
    ): Promise<ApiResponse<UserAgent[]>> {
        this.lookups.push({ method: 'parseUserAgents', args })
        const userAgents = Array.isArray(args[0])
            ? (args[0] as string[])
            : (args as string[])
        return respond(userAgents.map((header) => createUserAgent({ header })))
    }
}
