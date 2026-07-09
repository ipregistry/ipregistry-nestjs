import { defineConfig } from 'tsup'

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        testing: 'src/testing.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    target: 'es2022',
    external: [
        '@ipregistry/client',
        '@nestjs/common',
        '@nestjs/core',
        'reflect-metadata',
        'rxjs',
    ],
})
