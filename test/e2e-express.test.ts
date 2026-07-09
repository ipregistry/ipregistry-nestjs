import {
    Controller,
    Get,
    Module,
    UseGuards,
    UseInterceptors,
    type INestApplication,
    type MiddlewareConsumer,
    type NestModule,
} from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'

import {
    AllowCountries,
    BlockCountries,
    BlockThreats,
    ClientIp,
    Ipregistry,
    IpregistryCountriesGuard,
    IpregistryInterceptor,
    IpregistryMiddleware,
    IpregistryModule,
    IpregistryThreatsGuard,
    MissingApiKeyError,
    type IpregistryModuleOptions,
    type IpregistryRequestContext,
} from '../src/index.js'
import { FakeIpregistryClient } from '../src/testing.js'

const FRENCH_IP = '82.64.11.19'
const US_IP = '4.4.4.4'
const THREAT_IP = '5.6.7.8'
const FAILING_IP = '9.9.9.9'

function createFakeClient(): FakeIpregistryClient {
    return new FakeIpregistryClient({
        [US_IP]: { location: { country: { code: 'US' }, in_eu: false } },
        [THREAT_IP]: { security: { is_threat: true } },
        [FAILING_IP]: new Error('boom'),
    })
}

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

    @Get('not-enriched')
    notEnriched(@Ipregistry() ipregistry: IpregistryRequestContext) {
        return ipregistry
    }

    @Get('blocked-fr')
    @UseGuards(IpregistryCountriesGuard)
    @BlockCountries('FR')
    blockedFr() {
        return { ok: true }
    }

    @Get('allow-us')
    @UseGuards(IpregistryCountriesGuard)
    @AllowCountries('US')
    allowUs() {
        return { ok: true }
    }

    @Get('threats')
    @UseGuards(IpregistryThreatsGuard)
    @BlockThreats()
    threats(@Ipregistry() ipregistry: IpregistryRequestContext) {
        return { country: ipregistry.data?.location?.country?.code }
    }
}

let app: INestApplication | undefined

afterEach(async () => {
    await app?.close()
    app = undefined
})

async function createApp(
    options: IpregistryModuleOptions = {},
    extraProviders: unknown[] = [],
): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
        imports: [
            IpregistryModule.forRoot({
                client: createFakeClient(),
                ...options,
            }),
        ],
        controllers: [TestController],
        providers: extraProviders as [],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
    return app
}

describe('interceptor enrichment and decorators (Express)', () => {
    it('enriches the request and injects the context', async () => {
        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/context')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)

        expect(response.body.ip).toBe(FRENCH_IP)
        expect(response.body.data.location.country.code).toBe('FR')
    })

    it('skips lookups when no public client IP is available', async () => {
        const server = (await createApp()).getHttpServer()
        const response = await request(server).get('/context').expect(200)

        expect(response.body).toMatchObject({
            ip: null,
            data: null,
            skipped: 'no-ip',
        })
    })

    it('injects the client IP without any API call', async () => {
        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/ip')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)

        expect(response.body.clientIp).toBe(FRENCH_IP)
    })

    it('marks non-enriched requests', async () => {
        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/not-enriched')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)

        expect(response.body.skipped).toBe('not-enriched')
    })

    it('fails open on lookup errors by default', async () => {
        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/context')
            .set('x-real-ip', FAILING_IP)
            .expect(200)

        expect(response.body.data).toBeNull()
        expect(response.body.error.message).toBe('boom')
    })

    it('answers 503 on lookup errors with failOpen disabled', async () => {
        const server = (await createApp({ failOpen: false })).getHttpServer()

        await request(server)
            .get('/context')
            .set('x-real-ip', FAILING_IP)
            .expect(503)
    })
})

describe('country blocking (Express)', () => {
    it('blocks listed countries with 451', async () => {
        const server = (await createApp()).getHttpServer()

        await request(server)
            .get('/blocked-fr')
            .set('x-real-ip', FRENCH_IP)
            .expect(451)
        await request(server)
            .get('/blocked-fr')
            .set('x-real-ip', US_IP)
            .expect(200)
    })

    it('allows only listed countries', async () => {
        const server = (await createApp()).getHttpServer()

        await request(server)
            .get('/allow-us')
            .set('x-real-ip', US_IP)
            .expect(200)
        await request(server)
            .get('/allow-us')
            .set('x-real-ip', FRENCH_IP)
            .expect(451)
    })

    it('fails open when the country is undetermined', async () => {
        const server = (await createApp()).getHttpServer()

        await request(server)
            .get('/blocked-fr')
            .set('x-real-ip', FAILING_IP)
            .expect(200)
    })

    it('answers 503 for undetermined countries with failOpen disabled', async () => {
        const server = (await createApp({ failOpen: false })).getHttpServer()

        await request(server)
            .get('/allow-us')
            .set('x-real-ip', FAILING_IP)
            .expect(503)
    })

    it('applies module-level blockCountries with a global guard', async () => {
        const server = (
            await createApp({ blockCountries: ['fr'] }, [
                { provide: APP_GUARD, useClass: IpregistryCountriesGuard },
            ])
        ).getHttpServer()

        await request(server).get('/ip').set('x-real-ip', FRENCH_IP).expect(451)
        await request(server).get('/ip').set('x-real-ip', US_IP).expect(200)
    })
})

describe('threat blocking (Express)', () => {
    it('blocks flagged IPs with 403', async () => {
        const server = (await createApp()).getHttpServer()

        await request(server)
            .get('/threats')
            .set('x-real-ip', THREAT_IP)
            .expect(403)
        await request(server)
            .get('/threats')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)
    })

    it('shares the guard lookup with the handler', async () => {
        const server = (await createApp()).getHttpServer()
        const response = await request(server)
            .get('/threats')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)

        expect(response.body.country).toBe('FR')
    })

    it('applies module-level blockThreats with a global guard', async () => {
        const server = (
            await createApp({ blockThreats: true }, [
                { provide: APP_GUARD, useClass: IpregistryThreatsGuard },
            ])
        ).getHttpServer()

        await request(server).get('/ip').set('x-real-ip', THREAT_IP).expect(403)
        await request(server).get('/ip').set('x-real-ip', FRENCH_IP).expect(200)
    })
})

@Controller()
class MiddlewareController {
    @Get('middleware-context')
    context(@Ipregistry() ipregistry: IpregistryRequestContext) {
        return ipregistry
    }
}

@Module({
    imports: [IpregistryModule.forRoot({ client: createFakeClient() })],
    controllers: [MiddlewareController],
})
class MiddlewareAppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(IpregistryMiddleware).forRoutes(MiddlewareController)
    }
}

describe('middleware enrichment (Express)', () => {
    it('enriches requests before the handler runs', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [MiddlewareAppModule],
        }).compile()

        app = moduleRef.createNestApplication()
        await app.init()

        const response = await request(app.getHttpServer())
            .get('/middleware-context')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)

        expect(response.body.ip).toBe(FRENCH_IP)
        expect(response.body.data.location.country.code).toBe('FR')
    })
})

describe('module registration', () => {
    it('supports forRootAsync with a factory', async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                IpregistryModule.forRootAsync({
                    useFactory: () => ({ client: createFakeClient() }),
                }),
            ],
            controllers: [TestController],
        }).compile()

        app = moduleRef.createNestApplication()
        await app.init()

        const response = await request(app.getHttpServer())
            .get('/context')
            .set('x-real-ip', FRENCH_IP)
            .expect(200)

        expect(response.body.data.location.country.code).toBe('FR')
    })

    it('fails fast at bootstrap when no API key is configured', async () => {
        const previous = process.env.IPREGISTRY_API_KEY
        delete process.env.IPREGISTRY_API_KEY

        try {
            await expect(
                Test.createTestingModule({
                    imports: [IpregistryModule.forRoot({})],
                }).compile(),
            ).rejects.toThrow(MissingApiKeyError)
        } finally {
            if (previous !== undefined) {
                process.env.IPREGISTRY_API_KEY = previous
            }
        }
    })
})
