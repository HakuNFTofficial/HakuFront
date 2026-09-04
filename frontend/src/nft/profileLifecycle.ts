interface MintContractParameterResponse {
    contract_address?: string
    token_id?: string
    uint256_param?: number
}

interface LifecycleSummary {
    nft_id: number
    is_mint: number
}

export function requireMintContractParameters(
    response: MintContractParameterResponse,
    expectedContractAddress: string,
): {
    contractAddress: `0x${string}`
    remark: string
    uint256Param: bigint
} {
    const missingFields: string[] = []
    if (!response.contract_address) missingFields.push('contract_address')
    if (!response.token_id) missingFields.push('token_id')
    if (response.uint256_param === undefined || response.uint256_param === null) {
        missingFields.push('uint256_param')
    }

    if (missingFields.length > 0) {
        throw new Error(`Mint verification response is missing required fields: ${missingFields.join(', ')}`)
    }

    if (response.contract_address!.toLowerCase() !== expectedContractAddress.toLowerCase()) {
        throw new Error('Mint verification contract_address does not match the configured NFT contract')
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(response.contract_address!)) {
        throw new Error('Mint verification contract_address is invalid')
    }

    if (!Number.isSafeInteger(response.uint256_param) || response.uint256_param! < 0) {
        throw new Error('Mint verification uint256_param is invalid')
    }

    return {
        contractAddress: response.contract_address as `0x${string}`,
        remark: response.token_id!,
        uint256Param: BigInt(response.uint256_param!),
    }
}

export function reconcileApprovedNftIds(
    approvedNftIds: ReadonlySet<number>,
    visibleNfts: readonly LifecycleSummary[],
): Set<number> {
    const next = new Set(approvedNftIds)
    for (const nft of visibleNfts) {
        if (nft.is_mint !== 0) next.delete(nft.nft_id)
    }
    return next
}
