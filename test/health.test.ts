import { describe, expect, it } from 'vitest'

import {
    ClientError,
    IpregistryHealthIndicator,
    IpregistryService,
    validateModuleOptions,
} from '../src/index.js'
import { FakeIpregistryClient } from '../src/testing.js'

function createIndicator(client = new FakeIpregistryClient()) {
    return {
        indicator: new IpregistryHealthIndicator(
            new IpregistryService(client, {}),
        ),
        client,
    }
}

describe('IpregistryHealthIndicator', () => {
    it('reports up with remaining credits when the API answers', async () => {
        const { indicator, client } = createIndicator()
        const result = await indicator.isHealthy()

        expect(result).toEqual({
            ipregistry: { status: 'up' },
        })
        expect(client.lookups[0]).toEqual({
            method: 'lookupIp',
            args: ['8.8.8.8', { fields: 'ip' }],
        })
    })

    it('supports a custom key and probe IP', async () => {
        const { indicator, client } = createIndicator()
        const result = await indicator.isHealthy('geo-api', {
            probeIp: '1.1.1.1',
        })

        expect(result['geo-api']?.status).toBe('up')
        expect(client.lookups[0]?.args[0]).toBe('1.1.1.1')
    })

    it('reports down with the error details when the API fails', async () => {
        const { indicator } = createIndicator(
            new FakeIpregistryClient({
                '8.8.8.8': new ClientError('Request timed out'),
            }),
        )

        const result = await indicator.isHealthy()

        expect(result['ipregistry']).toEqual({
            status: 'down',
            code: 'CLIENT_ERROR',
            message: 'Request timed out',
        })
    })
})

describe('validateModuleOptions', () => {
    it('accepts a valid configuration', () => {
        expect(() =>
            validateModuleOptions({
                timeout: 3000,
                maxRetries: 0,
                developmentIp: '82.64.11.19',
                blockCountries: ['KP', 'ir'],
                allowCountries: ['FR'],
            }),
        ).not.toThrow()
    })

    it('rejects invalid country codes', () => {
        expect(() =>
            validateModuleOptions({ blockCountries: ['FRA'] }),
        ).toThrow(/blockCountries entry 'FRA'/)
        expect(() => validateModuleOptions({ allowCountries: ['F'] })).toThrow(
            /allowCountries entry 'F'/,
        )
    })

    it('rejects invalid development IPs', () => {
        expect(() =>
            validateModuleOptions({ developmentIp: 'not-an-ip' }),
        ).toThrow(/expected a valid IP address/)
        expect(() =>
            validateModuleOptions({ developmentIp: '192.168.0.1' }),
        ).toThrow(/expected a public IP address/)
    })

    it('rejects invalid timeouts and retries', () => {
        expect(() => validateModuleOptions({ timeout: 0 })).toThrow(/timeout/)
        expect(() => validateModuleOptions({ maxRetries: -1 })).toThrow(
            /maxRetries/,
        )
    })
})
