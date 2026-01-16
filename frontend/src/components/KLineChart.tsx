import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, CandlestickData, UTCTimestamp, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import { useWebSocket } from '../hooks/useWebSocket'
import { TRADING_PAIR_CONFIG } from '../config/contracts'

interface KlineUpdateEvent {
    pair_id: number
    interval: string
    start_time: number
    open: string
    high: string
    low: string
    close: string
    volume_base: string
    volume_quote: string
}

type TimeInterval = '1m' | '5m' | '1h' | '1d'

const INTERVAL_LABELS: Record<TimeInterval, string> = {
    '1m': '1m',
    '5m': '5m',
    '1h': '1h',
    '1d': '1d'
}

export function KLineChart() {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candlestickSeriesRef = useRef<any>(null)
    const volumeSeriesRef = useRef<any>(null)

    const [interval, setInterval] = useState<TimeInterval>('1m')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentPrice, setCurrentPrice] = useState<string>('0')
    const [priceChange, setPriceChange] = useState<number>(0)
    const [chartInitialized, setChartInitialized] = useState(false)

    // Fetch historical data
    useEffect(() => {
        const fetchHistoricalData = async () => {
            // Don't fetch if chart isn't initialized yet
            if (!chartRef.current || !candlestickSeriesRef.current || !volumeSeriesRef.current) {
                return
            }

            setIsLoading(true)
            setError(null)

            try {
                const response = await fetch(`/api/klines?pair_id=${TRADING_PAIR_CONFIG.PAIR_ID}&interval=${interval}`)
                if (!response.ok) {
                    throw new Error('Failed to fetch kline data')
                }

                const data: KlineUpdateEvent[] = await response.json()

                if (data.length === 0) {
                    setError('No data available')
                    setIsLoading(false)
                    return
                }

                // Transform data for TradingView chart
                const candlestickData: CandlestickData[] = data.map(item => ({
                    time: item.start_time as UTCTimestamp,
                    open: parseFloat(item.open),
                    high: parseFloat(item.high),
                    low: parseFloat(item.low),
                    close: parseFloat(item.close)
                }))

                const volumeData = data.map(item => ({
                    time: item.start_time as UTCTimestamp,
                    value: parseFloat(item.volume_base) / 1e18, // Scale down volume from wei
                    color: parseFloat(item.close) >= parseFloat(item.open) ? '#4ade8080' : '#ef444480'
                }))

                // Update series with data
                if (candlestickSeriesRef.current && volumeSeriesRef.current) {
                    candlestickSeriesRef.current.setData(candlestickData)
                    volumeSeriesRef.current.setData(volumeData)

                    // Set current price and calculate change
                    const lastCandle = data[data.length - 1]
                    const firstCandle = data[0]
                    setCurrentPrice(lastCandle.close)

                    const change = ((parseFloat(lastCandle.close) - parseFloat(firstCandle.open)) / parseFloat(firstCandle.open)) * 100
                    setPriceChange(change)
                }

                setIsLoading(false)
            } catch (err) {
                console.error('Failed to fetch kline data:', err)
                setError('Failed to load chart data')
                setIsLoading(false)
            }
        }

        fetchHistoricalData()
    }, [interval, chartInitialized])

    // WebSocket for real-time updates
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.host 
    const { status: wsStatus } = useWebSocket({
        url: `${wsProtocol}//${wsHost}/ws`, 
        enabled: !isLoading && !error,
        onMessage: (message: any) => {
            if (!candlestickSeriesRef.current || !volumeSeriesRef.current) {
                console.warn('Chart series not initialized, skipping update')
                return
            }

            console.log('WS Message received:', message)

            let dataToProcess = message

            // Handle wrapped messages (e.g. { type: 'KlineUpdate', data: ... })
            if (message.type) {
                if (message.type === 'KlineUpdate' && message.data) {
                    dataToProcess = message.data
                } else {
                    // Ignore other message types (like 'Swap')
                    return
                }
            }

            const events = Array.isArray(dataToProcess) ? dataToProcess : [dataToProcess]

            events.forEach((event: KlineUpdateEvent) => {
                // Only update if it's the current interval
                if (event.interval !== interval) {
                    return
                }

                console.log('Processing update for current interval:', event)

                const candleData: CandlestickData = {
                    time: event.start_time as UTCTimestamp,
                    open: parseFloat(event.open),
                    high: parseFloat(event.high),
                    low: parseFloat(event.low),
                    close: parseFloat(event.close)
                }

                const volumeData = {
                    time: event.start_time as UTCTimestamp,
                    value: parseFloat(event.volume_base) / 1e18, // Scale down volume from wei
                    color: parseFloat(event.close) >= parseFloat(event.open) ? '#4ade8080' : '#ef444480'
                }

                try {
                    // Update chart
                    candlestickSeriesRef.current.update(candleData)
                    volumeSeriesRef.current.update(volumeData)
                    console.log('Chart updated successfully')

                    // Update current price
                    setCurrentPrice(event.close)
                } catch (err) {
                    console.error('Error updating chart series:', err)
                }
            })
        }
    })

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 130,
            layout: {
                background: { color: '#1a1b23' },
                textColor: '#d1d5db',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: '#2a2b36' },
                horzLines: { color: '#2a2b36' }
            },
            crosshair: {
                mode: 1
            },
            rightPriceScale: {
                borderColor: '#2a2b36'
            },
            timeScale: {
                borderColor: '#2a2b36',
                timeVisible: true,
                secondsVisible: false,
                allowBoldLabels: false,
            }
        })

        // Create candlestick series
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#4ade80',
            downColor: '#ef4444',
            borderUpColor: '#4ade80',
            borderDownColor: '#ef4444',
            wickUpColor: '#4ade80',
            wickDownColor: '#ef4444'
        })

        // Configure candlestick series to take up most of the space
        candlestickSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.1, // Leave small space at top for high wicks
                bottom: 0.15, // Leave space at bottom for volume
            }
        })

        // Create volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#4ade8080',
            priceFormat: {
                type: 'volume'
            },
            priceScaleId: ''
        })

        // Configure volume series scale margins to push it to the very bottom
        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.85, // Push volume to bottom 15%
                bottom: 0
            }
        })

        chartRef.current = chart
        candlestickSeriesRef.current = candlestickSeries
        volumeSeriesRef.current = volumeSeries

        // Mark chart as initialized to trigger data fetch
        setChartInitialized(true)

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth
                })
            }
        }

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chart.remove()
        }
    }, [])

    return (
        <div className="bg-[#1a1b23] rounded-2xl p-1 pb-0 shadow-2xl border border-gray-800">
            {/* Header */}
            <div className="flex justify-between items-start mb-0">
                <div style={{ paddingLeft: '2px' }}>
                    <div className="flex items-center gap-2 mb-0">
                        <h2 className="text-xs font-bold text-white">{TRADING_PAIR_CONFIG.PAIR_NAME}</h2>
                        {/* WebSocket Status Indicator */}
                        <div className="flex items-center gap-1">
                            <div className={`w-1 h-1 rounded-full ${wsStatus === 'connected' ? 'bg-green-500' :
                                wsStatus === 'connecting' ? 'bg-yellow-500' :
                                    wsStatus === 'error' ? 'bg-red-500' :
                                        'bg-gray-500'
                                }`} />
                            <span className="text-[9px] text-gray-500">
                                {wsStatus === 'connected' ? 'Live' :
                                    wsStatus === 'connecting' ? '...' :
                                        wsStatus === 'error' ? 'Err' :
                                            'Off'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-bold text-white">${parseFloat(currentPrice).toFixed(4)}</span>
                        <span className={`text-[10px] font-medium ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                        </span>
                    </div>
                </div>

                {/* Interval Selector */}
                <div className="flex gap-0.5 bg-black/20 p-0.5 rounded-md">
                    {(Object.keys(INTERVAL_LABELS) as TimeInterval[]).map((int) => (
                        <button
                            key={int}
                            onClick={() => setInterval(int)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${interval === int
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {int.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>



            {/* Chart Container */}
            <div className="relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b23] z-10">
                        <div className="flex flex-col items-center gap-3">
                            <span className="loading loading-spinner loading-lg text-blue-500"></span>
                            <span className="text-gray-400 text-sm">Loading chart data…</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b23] z-10">
                        <div className="alert alert-error max-w-md">
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                <div ref={chartContainerRef} className="w-full" />
            </div>
        </div>
    )
}
