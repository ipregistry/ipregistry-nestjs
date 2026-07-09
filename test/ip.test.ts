import { describe, expect, it } from 'vitest'

import {
    anonymizeIp,
    createIpExtractor,
    isPrivateIp,
    isValidIp,
    sanitizeIp,
} from '../src/index.js'
import type { RequestLike } from '../src/index.js'

function request(
    headers: Record<string, string | string[] | undefined> = {},
    remoteAddress?: string,
): RequestLike {
    return {
        headers,
        socket: remoteAddress ? { remoteAddress } : undefined,
    }
}

describe('createIpExtractor', () => {
    it('uses x-real-ip first with the auto preset', () => {
        const extract = createIpExtractor('auto')

        expect(
            extract(
                request({
                    'x-real-ip': '1.2.3.4',
                    'x-forwarded-for': '5.6.7.8',
                }),
            ),
        ).toBe('1.2.3.4')
    })

    it('falls back to the first x-forwarded-for entry', () => {
        const extract = createIpExtractor('auto')

        expect(
            extract(request({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' })),
        ).toBe('5.6.7.8')
    })

    it('falls back to the socket address with the auto preset', () => {
        const extract = createIpExtractor('auto')

        expect(extract(request({}, '9.9.9.9'))).toBe('9.9.9.9')
    })

    it('unwraps IPv4-mapped socket addresses', () => {
        const extract = createIpExtractor('auto')

        expect(extract(request({}, '::ffff:9.9.9.9'))).toBe('9.9.9.9')
    })

    it('ignores headers with the socket preset', () => {
        const extract = createIpExtractor('socket')

        expect(extract(request({ 'x-real-ip': '1.2.3.4' }, '9.9.9.9'))).toBe(
            '9.9.9.9',
        )
    })

    it('supports the cloudflare preset', () => {
        const extract = createIpExtractor('cloudflare')

        expect(
            extract(
                request({
                    'cf-connecting-ip': '1.2.3.4',
                    'x-real-ip': '5.6.7.8',
                }),
            ),
        ).toBe('1.2.3.4')
        expect(extract(request({ 'x-real-ip': '5.6.7.8' }))).toBeNull()
    })

    it('supports a single custom header', () => {
        const extract = createIpExtractor({ header: 'X-Client-IP' })

        expect(extract(request({ 'x-client-ip': '1.2.3.4' }))).toBe('1.2.3.4')
    })

    it('supports a custom extractor function and validates its result', () => {
        const extract = createIpExtractor(() => 'not-an-ip')

        expect(extract(request())).toBeNull()
    })

    it('reads array header values', () => {
        const extract = createIpExtractor('auto')

        expect(extract(request({ 'x-real-ip': ['1.2.3.4', '5.6.7.8'] }))).toBe(
            '1.2.3.4',
        )
    })

    it('reads fetch Headers objects', () => {
        const extract = createIpExtractor('auto')

        expect(
            extract({ headers: new Headers({ 'x-real-ip': '1.2.3.4' }) }),
        ).toBe('1.2.3.4')
    })

    it('reads headers from the underlying raw request', () => {
        const extract = createIpExtractor('auto')
        const raw = request({ 'x-real-ip': '1.2.3.4' })

        expect(extract({ headers: undefined as never, raw })).toBe('1.2.3.4')
    })

    it('skips invalid values and keeps trying', () => {
        const extract = createIpExtractor('auto')

        expect(
            extract(
                request({
                    'x-real-ip': 'garbage',
                    'x-forwarded-for': '5.6.7.8',
                }),
            ),
        ).toBe('5.6.7.8')
    })

    it('returns null when nothing is available', () => {
        const extract = createIpExtractor('auto')

        expect(extract(request())).toBeNull()
    })
})

describe('sanitizeIp', () => {
    it('strips ports, brackets, zones, and mapped prefixes', () => {
        expect(sanitizeIp(' 1.2.3.4:8080 ')).toBe('1.2.3.4')
        expect(sanitizeIp('[2001:db8::1]:443')).toBe('2001:db8::1')
        expect(sanitizeIp('fe80::1%eth0')).toBe('fe80::1')
        expect(sanitizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
    })
})

describe('isValidIp', () => {
    it('accepts valid addresses', () => {
        expect(isValidIp('1.2.3.4')).toBe(true)
        expect(isValidIp('2001:db8::1')).toBe(true)
        expect(isValidIp('::ffff:1.2.3.4')).toBe(true)
    })

    it('rejects invalid addresses', () => {
        expect(isValidIp('256.1.1.1')).toBe(false)
        expect(isValidIp('1.2.3')).toBe(false)
        expect(isValidIp('hello')).toBe(false)
        expect(isValidIp('2001:db8:::1')).toBe(false)
    })
})

describe('isPrivateIp', () => {
    it('flags private and reserved ranges', () => {
        for (const ip of [
            '10.1.2.3',
            '127.0.0.1',
            '192.168.0.10',
            '172.16.5.5',
            '100.64.0.1',
            '169.254.1.1',
            '::1',
            '::ffff:192.168.0.1',
            'fc00::1',
            'fe80::1',
        ]) {
            expect(isPrivateIp(ip), ip).toBe(true)
        }
    })

    it('does not flag public addresses', () => {
        for (const ip of ['8.8.8.8', '82.64.11.19', '2001:db8::1']) {
            expect(isPrivateIp(ip), ip).toBe(false)
        }
    })
})

describe('anonymizeIp', () => {
    it('masks addresses for logging', () => {
        expect(anonymizeIp('82.64.11.19')).toBe('82.64.11.0')
        expect(anonymizeIp('2001:db8:1:2:3::1')).toBe('2001:db8:1::')
        expect(anonymizeIp('garbage')).toBe('invalid')
    })
})
