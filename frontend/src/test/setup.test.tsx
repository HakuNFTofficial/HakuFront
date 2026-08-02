import { render, screen } from '@testing-library/react'

test('renders React components in jsdom', () => {
    render(<button type="button">Connect</button>)
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
})
