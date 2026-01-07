import { defineConfig } from '@trigger.dev/sdk/v3'

if (!process.env.TRIGGER_SECRET_KEY && process.env.TRIGGER_DEV_API_KEY) {
  process.env.TRIGGER_SECRET_KEY = process.env.TRIGGER_DEV_API_KEY
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_replace_me',
  runtime: 'node',
  maxDuration: 900,
  dirs: ['trigger'],
})
