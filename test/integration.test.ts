/**
 * End-to-end tests through the real @ipregistry/client SDK with the HTTP
 * layer mocked: interceptor -> IpregistryService -> SDK -> (mock) API ->
 * request context -> @Ipregistry() decorator.
 */
import { Controller, Get, UseInterceptors } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { INestApplication } from '@nestjs/common'

import {
    Ipregistry,
    IpregistryInterceptor,
    IpregistryModule,
    type IpregistryRequestContext,
} from '../src/index.js'
import { createIpInfo } from '../src/testing.js'

const PUBLIC_IP = '82.64.11.19'

function apiResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json',
            'ipregistry-credits-consumed': '1',
            'ipregistry-credits-remaining': '99',
        },
    })
}

@Controller()
class TestController {
    @Get('context')
    @UseInterceptors(IpregistryInterceptor)
    context(@Ipregistry() ipregistry: IpregistryRequestContext) {
        return ipregistry
    }
}

let app: INestApplication | undefined

afterEach(async () => {
    await app?.close()
    app = undefined
    vi.unstubAllGlobals()
})

async function createApp(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
        imports: [
            IpregistryModule.forRoot({
                apiKey: 'test-key',
                fields: 'location,security',
                maxRetries: 0,
            }),
        ],
        controllers: [TestController],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
    return app
}

describe('interceptor -> real SDK -> decorator integration', () => {
    it('enriches a request end to end through the SDK', async () => {
        const fetchMock = vi.fn(
            async (input: RequestInfo | URL, init?: RequestInit) => {
                expect(String(input)).toContain(`/${PUBLIC_IP}`)
                expect(String(input)).toContain('fields=location%2Csecurity')
                expect(
                    (init?.headers as Record<string, string>).authorization,
                ).toBe('ApiKey test-key')
                return apiResponse(createIpInfo({ ip: PUBLIC_IP }))
            },
        )
        vi.stubGlobal('fetch', fetchMock)

        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/context')
            .set('x-real-ip', PUBLIC_IP)
            .expect(200)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(response.body.ip).toBe(PUBLIC_IP)
        expect(response.body.data.location.country.code).toBe('FR')
        expect(response.body.error).toBeUndefined()
    })

    it('serves repeated lookups for the same IP from the SDK cache', async () => {
        const fetchMock = vi.fn(async () =>
            apiResponse(createIpInfo({ ip: PUBLIC_IP })),
        )
        vi.stubGlobal('fetch', fetchMock)

        const server = (await createApp()).getHttpServer()
        await request(server)
            .get('/context')
            .set('x-real-ip', PUBLIC_IP)
            .expect(200)
        await request(server)
            .get('/context')
            .set('x-real-ip', PUBLIC_IP)
            .expect(200)

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('maps real API errors into the request context', async () => {
        const fetchMock = vi.fn(async () =>
            apiResponse(
                {
                    code: 'FORBIDDEN_IP',
                    message: 'Your IP address is blocked.',
                    resolution: 'Contact support.',
                },
                403,
            ),
        )
        vi.stubGlobal('fetch', fetchMock)

        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/context')
            .set('x-real-ip', PUBLIC_IP)
            .expect(200)

        expect(response.body.data).toBeNull()
        expect(response.body.error).toEqual({
            code: 'FORBIDDEN_IP',
            message: 'Your IP address is blocked.',
        })
    })
})
