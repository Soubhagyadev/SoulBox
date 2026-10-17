import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './Layout'

function renderLayout(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <>
                <p>Home content</p>
                <section id="how-it-works">How it works</section>
              </>
            }
          />
          <Route path="*" element={<p>Not found content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  it('renders a skip link, side navigation, main landmark, and footer', () => {
    renderLayout('/')
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByText('Home content')).toBeInTheDocument()
  })

  it('scrolls the hash target into view when present', () => {
    renderLayout('/#how-it-works')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
