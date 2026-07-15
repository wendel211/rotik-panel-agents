/* oxlint-disable react/only-export-components -- componentes são stubs globais do Motion nos testes */
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import React, { forwardRef } from 'react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.restoreAllMocks()
})

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  },
})

Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  },
})

vi.mock('motion/react', () => {
  const cache = new Map<PropertyKey, React.ComponentType<Record<string, unknown>>>()
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        if (!cache.has(tag)) {
          cache.set(
            tag,
            forwardRef<HTMLElement, Record<string, unknown>>(function MotionElement(props, ref) {
              const { children, initial, animate, exit, transition, ...domProps } = props
              void initial
              void animate
              void exit
              void transition
              return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode)
            }),
          )
        }
        return cache.get(tag)
      },
    },
  )

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useReducedMotion: () => false,
  }
})
