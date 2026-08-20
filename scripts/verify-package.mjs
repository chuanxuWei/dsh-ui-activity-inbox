import { access, readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const required = [
  'lib/index.js',
  'lib/client.js',
  'lib/client.js.map',
  'lib/types/index.d.ts',
  'lib/types/client/index.d.ts',
  'cordis.patch.yml',
]

await Promise.all(required.map(path => access(new URL(path, root))))

const client = await readFile(new URL('lib/client.js', root), 'utf8')
if (!/window\.__ModuleLoader__\.load\(\{\s*id:\s*["']dsh-ui-activity-inbox["']/.test(client)) {
  throw new Error('client bundle is missing the DSH ModuleLoader factory wrapper')
}
if (!client.includes('sidebar.footer.action')) {
  throw new Error('client bundle does not register the supported sidebar.footer.action slot')
}
if (client.includes('sidebar.workspaces.action')) {
  throw new Error('client bundle still depends on the unpublished sidebar.workspaces.action slot')
}
if (!client.includes('data-plugin-css')) {
  throw new Error('client bundle is missing lifecycle-owned CSS injection')
}
if (client.includes('@deepseek-ai/')) {
  throw new Error('client bundle contains a DSH package instead of using host-provided contracts')
}

const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
  throw new Error('package manifest is missing the DSH bundle patch declaration')
}
if (manifest.dsh?.client?.platform !== 'web') {
  throw new Error('package manifest is missing the Web client declaration')
}
const expectedInject = [
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-sidebar',
]
if (JSON.stringify(manifest.dsh?.client?.inject) !== JSON.stringify(expectedInject)) {
  throw new Error('package manifest has an unexpected DSH client injection boundary')
}

console.log(`verify-package: ${required.length} artifacts and DSH metadata checks passed`)
