# IPFS Image Gateway Hotfix Design

## Objective

Restore NFT image rendering on `https://www.hakupump.club/` without changing image CIDs, metadata, database records, or smart contracts.

## Verified Failure

The production bundle uses:

```text
https://ipfs.io/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/{fileName}
```

On 2026-08-29, requests to `ipfs.io` timed out. `nftstorage.link` returned a redirect to the same unavailable `ipfs.io` URL. The same image, including `572.png`, returned HTTP 200 with a PNG body and permissive CORS headers through:

```text
https://gateway.pinata.cloud/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/{fileName}
```

This isolates the immediate failure to the selected public gateway. The image content and configured image CID remain available.

## Considered Approaches

1. **Pinata default with build-time override — selected.** Change the frontend default gateway to Pinata and allow `VITE_IPFS_GATEWAY` to override it. This is the smallest deployable change and keeps all existing URL-building call sites intact.
2. **Same-origin Nginx proxy.** This would give the frontend a stable first-party URL, but it requires production server configuration and still needs an upstream storage policy. It is suitable as a later reliability improvement.
3. **Browser-side multi-gateway fallback.** This can tolerate an individual gateway outage, but each failed attempt delays image rendering and adds request/state handling to several image components. It is outside this hotfix.

## Selected Design

`frontend/src/config/ipfs.ts` remains the single source for browser-facing IPFS URLs.

- Default gateway: `https://gateway.pinata.cloud/ipfs/`.
- Optional build-time override: `VITE_IPFS_GATEWAY`.
- Normalize the configured gateway to exactly one trailing slash so URL construction remains valid.
- Preserve the existing image, metadata, and root CIDs.
- Preserve existing helpers and component interfaces. `NFTImageStatic`, `NFTImageViewer`, `NFTImageReveal`, and `Banner` continue to consume the shared configuration.

The override is build-time configuration. Changing it on a deployed static bundle requires rebuilding and redeploying the frontend.

## Data Flow

1. Vite reads `VITE_IPFS_GATEWAY` during the production build.
2. The shared IPFS configuration uses the normalized override, or the Pinata default when the variable is absent.
3. Image components construct `{gateway}{imageCID}/{fileName}`.
4. The browser requests the existing immutable CID through the selected gateway.

No wallet data, user identifier, database field, or private value is sent to the gateway beyond the public CID and public image filename already present in the current requests.

## Error Handling

The hotfix keeps the current component error UI if Pinata or the underlying CID becomes unavailable. It does not silently derive another CID, substitute a different NFT image, or guess a filename.

Operations should validate a representative image URL before every deployment. A later same-origin proxy can add monitored upstream failover without complicating browser components.

## Tests

Add focused tests for the shared IPFS configuration:

- The default image URL uses the Pinata gateway and preserves the configured CID and filename.
- `ipfs://` conversion uses the same selected gateway.
- A gateway override is normalized correctly, including an override without a trailing slash.

Run the focused test first and observe it fail against the current `ipfs.io` default. After the implementation, run the focused test, the full frontend test suite, TypeScript/Vite production build, and a live HTTP check of a representative Pinata image.

## Deployment and Rollback

Build the frontend from this branch and deploy the generated static files using the existing production procedure. Verify the versioned site, representative NFT cards, and direct gateway responses after deployment.

Rollback consists of redeploying the previous static bundle. Because CIDs, contracts, backend state, and database contents are unchanged, this hotfix has no data migration or chain rollback.

## Follow-up

Treat public-gateway availability as an operational dependency. Independently of this hotfix, restore or replace the unavailable self-hosted IPFS gateway, pin the image and metadata roots to at least two independent providers, and consider a monitored same-origin image endpoint.
