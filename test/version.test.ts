import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { LIBRARY_VERSION } from '../src/index.js'

describe('LIBRARY_VERSION', () => {
    it('matches package.json', () => {
        const packageJson = JSON.parse(
            readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
        ) as { version: string }

        expect(LIBRARY_VERSION).toBe(packageJson.version)
    })
})
