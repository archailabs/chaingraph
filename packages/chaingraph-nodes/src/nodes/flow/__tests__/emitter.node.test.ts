/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import { ExecutionContext } from '@badaitech/chaingraph-types'
import { describe, expect, it, vi } from 'vitest'
import EventEmitterNode from '../emitter.node'

function getTestContext(): ExecutionContext {
  const abortController = new AbortController()
  const context = new ExecutionContext('test-flow', abortController)
  // Mock the emitEvent method
  context.emitEvent = vi.fn()
  return context
}

describe('eventEmitterNode', () => {
  it('should emit an event with the specified name and data', async () => {
    const node = new EventEmitterNode('emitter-1')
    node.initialize()

    // Set event data
    node.eventData.eventName = 'test-event'

    const context = getTestContext()

    // Execute node
    await node.execute(context)

    // Verify emitEvent was called
    expect(context.emitEvent).toHaveBeenCalledWith('test-event', node.eventData)
  })

  it('should throw an error when event name is empty', async () => {
    const node = new EventEmitterNode('emitter-2')
    node.initialize()

    // Leave event name empty
    node.eventData.eventName = ''

    const context = getTestContext()

    // Execute node and expect error
    await expect(node.execute(context)).rejects.toThrow('Event name is required to emit an event')
  })

  it('should throw an error when context does not support event emission', async () => {
    const node = new EventEmitterNode('emitter-3')
    node.initialize()

    node.eventData.eventName = 'test-event'

    // Create context without emitEvent
    const abortController = new AbortController()
    const context = new ExecutionContext('test-flow', abortController)
    // ExecutionContext has emitEvent defined, so we need to set it to undefined
    ;(context as any).emitEvent = undefined

    // Execute node and expect error
    await expect(node.execute(context)).rejects.toThrow('Event emission is not supported in this context')
  })

  it('should track currentNodeId when emitting events', async () => {
    const node = new EventEmitterNode('emitter-4')
    node.initialize()

    node.eventData.eventName = 'test-event'

    // Create real context to test emittedEvents
    const abortController = new AbortController()
    const context = new ExecutionContext('test-flow', abortController)
    context.currentNodeId = 'emitter-4'

    // Execute node
    await node.execute(context)

    // Verify event was added to emittedEvents
    expect(context.emittedEvents).toBeDefined()
    expect(context.emittedEvents!.length).toBe(1)
    expect(context.emittedEvents![0]).toMatchObject({
      type: 'test-event',
      emittedBy: 'emitter-4',
      data: node.eventData,
    })
  })
})
