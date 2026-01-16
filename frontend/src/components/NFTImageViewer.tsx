import { useState, useEffect } from 'react'
import { getIPFSImageUrl } from '../config/ipfs'

interface NFTImageViewerProps {
    nft: {
        nft_id: number
        file_name: string | null
        is_mint?: number
    }
    isOpen: boolean
    onClose: () => void
}

export function NFTImageViewer({ nft, isOpen, onClose }: NFTImageViewerProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Load image
    useEffect(() => {
        if (!isOpen || !nft.file_name) {
            return
        }

        setIsLoading(true)
        setError(null)
        const imagePath = getIPFSImageUrl(nft.file_name)
        
        const img = new Image()
        img.onload = () => {
            setImageUrl(imagePath)
            setIsLoading(false)
        }
        
        img.onerror = () => {
            setError('Unable to load image')
            setIsLoading(false)
        }
        
        img.src = imagePath
    }, [isOpen, nft.file_name])

    // Save image
    const handleSaveImage = async () => {
        if (!imageUrl) return

        try {
            setSaving(true)
            
            // Due to CORS restrictions, cannot use fetch to get image blob
            // We use direct download link method
            // Although may not be able to force download due to CORS, at least can open in new tab
            const link = document.createElement('a')
            link.href = imageUrl
            link.download = `NFT-${nft.nft_id}${nft.file_name ? '-' + nft.file_name : '.png'}`
            link.target = '_blank'
            link.rel = 'noopener noreferrer'
            
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            // Since we can't detect if actually downloaded, we assume success
            // If download attribute fails due to CORS, browser will open image in new tab where user can right-click to save
            setTimeout(() => {
                setSaving(false)
            }, 300)
        } catch (err) {
            console.error('Failed to save image:', err)
            setSaving(false)
            // If failed, provide alternative
            const openInNewTab = window.confirm('Direct download may fail due to browser restrictions. Open image in new tab for manual save?')
            if (openInNewTab) {
                window.open(imageUrl, '_blank', 'noopener,noreferrer')
            }
        }
    }

    // Close on ESC key press
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        
        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden' // Prevent background scrolling
        }
        
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = ''
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative bg-[#1a1b23] rounded-2xl shadow-2xl max-w-[90vw] max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header toolbar */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-white font-bold text-lg">
                        NFT #{nft.nft_id}
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Save button */}
                        <button
                            onClick={handleSaveImage}
                            disabled={!imageUrl || saving}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <span className="loading loading-spinner loading-xs"></span>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Save</span>
                                </>
                            )}
                        </button>
                        
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Image area */}
                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <span className="loading loading-spinner loading-lg text-primary"></span>
                            <p className="text-gray-400 mt-4">Loading image...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <p className="text-red-400">{error}</p>
                        </div>
                    ) : imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={`NFT ${nft.nft_id}`}
                            className="max-w-full max-h-[calc(90vh-120px)] object-contain rounded-lg"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    )
}

