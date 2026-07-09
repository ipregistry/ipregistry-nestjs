import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common'
import {
    FastifyAdapter,
    type NestFastifyApplication,
} from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { afterEach, describe, expect, it } from 'vitest'

import {
    BlockCountries,
    BlockThreats,
    ClientIp,
    Ipregistry,
    IpregistryCountriesGuard,
    IpregistryInterceptor,
    IpregistryModule,
    IpregistryThreatsGuard,
    type IpregistryRequestContext,
} from '../src/index.js'
import { FakeIpregistryClient } from '../src/testing.js'

const FRENCH_IP = '82.64.11.19'
const THREAT_IP = '5.6.7.8'

@Controller()
class TestController {
    @Get('context')
    @UseInterceptors(IpregistryInterceptor)
    context(@Ipregistry() ipregistry: IpregistryRequestContext) {
        return ipregistry
    }

    @Get('ip')
    ip(@ClientIp() clientIp: string | null) {
        return { clientIp }
    }

    @Get('blocked-fr')
    @UseGuards(IpregistryCountriesGuard)
    @BlockCountries('FR')
    blockedFr() {
        return { ok: true }
    }

    @Get('threats')
    @UseGuards(IpregistryThreatsGuard)
    @BlockThreats()
    threats() {
        return { ok: true }
    }
}

let app: NestFastifyApplication | undefined

afterEach(async () => {
    await app?.close()
    app = undefined
})

async function createApp(): Promise<NestFastifyApplication> {
    const moduleRef = await Test.createTestingModule({
        imports: [
            IpregistryModule.forRoot({
                client: new FakeIpregistryClient({
                    [THREAT_IP]: { security: { is_threat: true } },
                }),
            }),
        ],
        controllers: [TestController],
    }).compile()

    app = moduleRef.createNestApplication<NestFastifyApplication>(
        new FastifyAdapter(),
    )
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    return app
}

describe('Fastify adapter', () => {
    it('enriches requests through the interceptor', async () => {
        const response = await (
            await createApp()
        ).inject({
            method: 'GET',
            url: '/context',
            headers: { 'x-real-ip': FRENCH_IP },
        })

        expect(response.statusCode).toBe(200)
        const body = response.json() as IpregistryRequestContext
        expect(body.ip).toBe(FRENCH_IP)
        expect(body.data?.location?.country?.code).toBe('FR')
    })

    it('injects the client IP', async () => {
        const response = await (
            await createApp()
        ).inject({
            method: 'GET',
            url: '/ip',
            headers: { 'x-real-ip': FRENCH_IP },
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ clientIp: FRENCH_IP })
    })

    it('blocks countries with 451', async () => {
        const response = await (
            await createApp()
        ).inject({
            method: 'GET',
            url: '/blocked-fr',
            headers: { 'x-real-ip': FRENCH_IP },
        })

        expect(response.statusCode).toBe(451)
    })

    it('blocks threats with 403', async () => {
        const response = await (
            await createApp()
        ).inject({
            method: 'GET',
            url: '/threats',
            headers: { 'x-real-ip': THREAT_IP },
        })

        expect(response.statusCode).toBe(403)
    })
})
