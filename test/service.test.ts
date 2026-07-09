import { describe, expect, it, vi } from 'vitest'

import { IpregistryService } from '../src/index.js'
import type { IpregistryModuleOptions, RequestLike } from '../src/index.js'
import { FakeIpregistryClient } from '../src/testing.js'

function createService(
    options: IpregistryModuleOptions = {},
    client = new FakeIpregistryClient(),
): { service: IpregistryService; client: FakeIpregistryClient } {
    return { service: new IpregistryService(client, options), client }
}

function request(
    headers: Record<string, string | string[] | undefined> = {},
): RequestLike {
    return { headers }
}

describe('IpregistryService.lookupRequest', () => {
    it('looks up the extracted client IP', async () => {
        const { service, client } = createService()
        const context = await service.lookupRequest(
            request({ 'x-real-ip': '82.64.11.19' }),
        )

        expect(context.ip).toBe('82.64.11.19')
        expect(context.data?.location?.country?.code).toBe('FR')
        expect(context.error).toBeUndefined()
        expect(client.lookups).toHaveLength(1)
    })

    it('memoizes the lookup per request', async () => {
        const { service, client } = createService()
        const req = request({ 'x-real-ip': '82.64.11.19' })

        const [first, second] = await Promise.all([
            service.lookupRequest(req),
            service.lookupRequest(req),
        ])
        const third = await service.lookupRequest(req)

        expect(first).toBe(second)
        expect(first).toBe(third)
        expect(client.lookups).toHaveLength(1)
    })

    it('shares the memo between a wrapper request and its raw request', async () => {
        const { service, client } = createService()
        const raw = request({ 'x-real-ip': '82.64.11.19' })
        const wrapper: RequestLike = { headers: raw.headers, raw }

        await service.lookupRequest(wrapper)
        await service.lookupRequest(raw)

        expect(client.lookups).toHaveLength(1)
    })

    it('attaches the context to the request and its raw request', async () => {
        const { service } = createService()
        const raw = request({ 'x-real-ip': '82.64.11.19' })
        const wrapper: RequestLike = { headers: raw.headers, raw }

        const context = await service.lookupRequest(wrapper)

        expect(
            (wrapper as unknown as Record<string, unknown>)['ipregistry'],
        ).toBe(context)
        expect((raw as unknown as Record<string, unknown>)['ipregistry']).toBe(
            context,
        )
    })

    it('skips private client IPs without calling the API', async () => {
        const { service, client } = createService()
        const context = await service.lookupRequest(
            request({ 'x-real-ip': '192.168.1.10' }),
        )

        expect(context).toMatchObject({
            ip: null,
            data: null,
            skipped: 'no-ip',
        })
        expect(client.lookups).toHaveLength(0)
    })

    it('substitutes the development IP for private client IPs', async () => {
        const { service } = createService({ developmentIp: '82.64.11.19' })
        const context = await service.lookupRequest(
            request({ 'x-real-ip': '127.0.0.1' }),
        )

        expect(context.ip).toBe('82.64.11.19')
        expect(context.data).not.toBeNull()
    })

    it('applies the configured fields and hostname options', async () => {
        const { service, client } = createService({
            fields: 'location,security',
            hostname: true,
        })

        await service.lookupRequest(request({ 'x-real-ip': '82.64.11.19' }))

        expect(client.lookups[0]).toEqual({
            method: 'lookupIp',
            args: [
                '82.64.11.19',
                { fields: 'location,security', hostname: true },
            ],
        })
    })

    it('never throws and reports failures through onError', async () => {
        const onError = vi.fn()
        const failure = new Error('boom')
        const { service } = createService(
            { onError },
            new FakeIpregistryClient({ '82.64.11.19': failure }),
        )

        const context = await service.lookupRequest(
            request({ 'x-real-ip': '82.64.11.19' }),
        )

        expect(context.ip).toBe('82.64.11.19')
        expect(context.data).toBeNull()
        expect(context.error).toEqual({
            code: 'CLIENT_ERROR',
            message: 'boom',
        })
        expect(onError).toHaveBeenCalledWith(failure, '82.64.11.0')
    })

    it('honors a custom ipSource', async () => {
        const { service } = createService({
            ipSource: { header: 'cf-connecting-ip' },
        })

        const context = await service.lookupRequest(
            request({
                'cf-connecting-ip': '82.64.11.19',
                'x-real-ip': '1.2.3.4',
            }),
        )

        expect(context.ip).toBe('82.64.11.19')
    })
})

describe('IpregistryService passthroughs', () => {
    it('delegates to the underlying client', async () => {
        const { service, client } = createService()

        const single = await service.lookupIp('82.64.11.19')
        const batch = await service.batchLookupIps(['1.1.1.1', '8.8.8.8'])
        const origin = await service.originLookupIp()
        const asn = await service.lookupAsn(12322)
        const asns = await service.batchLookupAsns([12322, 3215])
        const originAsn = await service.originLookupAsn()
        const userAgents = await service.parseUserAgents(['curl/8.0'])

        expect(single.data.ip).toBe('82.64.11.19')
        expect(batch.data).toHaveLength(2)
        expect(origin.data.user_agent).toBeDefined()
        expect(asn.data.asn).toBe(12322)
        expect(asns.data).toHaveLength(2)
        expect(originAsn.data.asn).toBeDefined()
        expect(userAgents.data[0]?.header).toBe('curl/8.0')
        expect(client.lookups.map((lookup) => lookup.method)).toEqual([
            'lookupIp',
            'batchLookupIps',
            'originLookupIp',
            'lookupAsn',
            'batchLookupAsns',
            'originLookupAsn',
            'parseUserAgents',
        ])
    })

    it('exposes the boolean helpers', async () => {
        const { service } = createService()
        const context = await service.lookupRequest(
            request({ 'x-real-ip': '82.64.11.19' }),
        )

        expect(service.isEuVisitor(context)).toBe(true)
        expect(service.isThreat(context)).toBe(false)
        expect(service.isBot('curl/8.0')).toBe(false)
    })
})
