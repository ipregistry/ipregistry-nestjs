import { describe, expect, it } from 'vitest'

import { isBot, isEuVisitor, isThreat } from '../src/index.js'
import type { IpregistryRequestContext } from '../src/index.js'
import { createIpInfo } from '../src/testing.js'

const BOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const BROWSER_UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function contextFor(
    data: ReturnType<typeof createIpInfo> | null,
): IpregistryRequestContext {
    return { ip: data?.ip ?? null, data }
}

describe('isEuVisitor', () => {
    it('answers from location.in_eu', () => {
        expect(isEuVisitor(createIpInfo())).toBe(true)
        expect(isEuVisitor(createIpInfo({ location: { in_eu: false } }))).toBe(
            false,
        )
    })

    it('accepts a request context', () => {
        expect(isEuVisitor(contextFor(createIpInfo()))).toBe(true)
    })

    it('fails open on missing data unless assumeEu is set', () => {
        expect(isEuVisitor(null)).toBe(false)
        expect(isEuVisitor(contextFor(null))).toBe(false)
        expect(isEuVisitor(null, { assumeEu: true })).toBe(true)
    })
})

describe('isThreat', () => {
    it('checks threat, attacker, and abuser by default', () => {
        expect(isThreat(createIpInfo())).toBe(false)
        expect(isThreat(createIpInfo({ security: { is_threat: true } }))).toBe(
            true,
        )
        expect(
            isThreat(createIpInfo({ security: { is_attacker: true } })),
        ).toBe(true)
        expect(isThreat(createIpInfo({ security: { is_abuser: true } }))).toBe(
            true,
        )
    })

    it('leaves anonymization signals opt-in', () => {
        const vpn = createIpInfo({ security: { is_vpn: true } })
        const tor = createIpInfo({ security: { is_tor_exit: true } })

        expect(isThreat(vpn)).toBe(false)
        expect(isThreat(vpn, { vpn: true })).toBe(true)
        expect(isThreat(tor)).toBe(false)
        expect(isThreat(tor, { tor: true })).toBe(true)
    })

    it('allows disabling default signals', () => {
        const threat = createIpInfo({ security: { is_threat: true } })

        expect(isThreat(threat, { threat: false })).toBe(false)
    })

    it('returns false on missing data', () => {
        expect(isThreat(null)).toBe(false)
        expect(isThreat(contextFor(null))).toBe(false)
    })
})

describe('isBot', () => {
    it('detects bots from user agent strings', () => {
        expect(isBot(BOT_UA)).toBe(true)
        expect(isBot(BROWSER_UA)).toBe(false)
    })

    it('reads the user-agent header from request-like objects', () => {
        expect(isBot({ headers: { 'user-agent': BOT_UA } })).toBe(true)
        expect(isBot({ headers: new Headers({ 'user-agent': BOT_UA }) })).toBe(
            true,
        )
    })

    it('returns false when no user agent is available', () => {
        expect(isBot(null)).toBe(false)
        expect(isBot({ headers: {} })).toBe(false)
    })
})
