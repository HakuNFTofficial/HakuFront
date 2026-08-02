import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const output = execFileSync(
  'forge',
  ['inspect', 'HukuNFT', 'storageLayout', '--json'],
  { encoding: 'utf8' },
)

JSON.parse(output)
mkdirSync('deployments/arc-testnet', { recursive: true })
writeFileSync(
  'deployments/arc-testnet/HukuNFT-v1-storage-layout.json',
  `${output.trim()}\n`,
)
