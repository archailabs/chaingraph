/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { FlowEvent } from '@badaitech/chaingraph-types'
import {
  createQueueIterator,
  EventQueue,
  FlowEventType,
  newEvent,
} from '@badaitech/chaingraph-types'
import { tracked } from '@trpc/server'
import { z } from 'zod'
import { flowContextProcedure } from '../../trpc'
import { zAsyncIterable } from '../subscriptions/utils/zAsyncIterable'

function isAcceptedEventType(eventTypes: FlowEventType[] | undefined, type: FlowEventType) {
  return !eventTypes || eventTypes.length === 0 || eventTypes.includes(type)
}

export const subscribeToEvents = flowContextProcedure
  .input(
    z.object({
      flowId: z.string(),
      eventTypes: z.array(z.nativeEnum(FlowEventType)).optional(),
      lastEventId: z.string().nullish(),
    }),
  )
  .output(
    zAsyncIterable({
      yield: z.custom<FlowEvent>(),
      tracked: true,
    }),
  )
  .subscription(async function* ({ input, ctx }) {
    const { flowId, eventTypes, lastEventId } = input
    const flow = await ctx.flowStore.getFlow(flowId)

    if (!flow) {
      throw new Error(`Flow with ID ${flowId} not found`)
    }

    let eventIndex = Number(lastEventId) || 0
    const eventQueue = new EventQueue<FlowEvent>(1000)

    try {
      // Subscribe to future events
      const unsubscribe = flow.onEvent(async (event) => {
        // Filter by event types if specified
        if (!isAcceptedEventType(eventTypes, event.type)) {
          return
        }

        await eventQueue.publish(event)
      })

      // Send initial state events
      // 1. Metadata
      // if (!eventTypes || eventTypes?.includes(FlowEventType.MetadataUpdated)) {
      if (isAcceptedEventType(eventTypes, FlowEventType.FlowInitStart)) {
        yield tracked(String(eventIndex++), newEvent(eventIndex, flowId, FlowEventType.FlowInitStart, {
          flowId,
          metadata: flow.metadata,
        }))
      }

      // 2. Existing nodes
      if (isAcceptedEventType(eventTypes, FlowEventType.NodesAdded)) {
        const noParentNodes = Array.from(flow.nodes.values())
          .filter(node => !node.metadata.parentNodeId)

        const parentedNodes = Array.from(flow.nodes.values())
          .filter(node => node.metadata.parentNodeId)

        if (noParentNodes.length > 0) {
          yield tracked(String(eventIndex++), newEvent(eventIndex, flowId, FlowEventType.NodesAdded, {
            nodes: noParentNodes,
          }))
        }

        if (parentedNodes.length > 0) {
          yield tracked(String(eventIndex++), newEvent(eventIndex, flowId, FlowEventType.NodesAdded, {
            nodes: parentedNodes,
          }))
        }
      }

      // 3. Existing edges
      if (isAcceptedEventType(eventTypes, FlowEventType.EdgesAdded)) {
        const edges = Array.from(flow.edges.values()).map((edge) => {
          return {
            edgeId: edge.id,
            sourceNodeId: edge.sourceNode.id,
            sourcePortId: edge.sourcePort.id,
            targetNodeId: edge.targetNode.id,
            targetPortId: edge.targetPort.id,
            metadata: edge.metadata,
          }
        })

        if (edges.length > 0) {
          yield tracked(String(eventIndex++), newEvent(eventIndex, flowId, FlowEventType.EdgesAdded, {
            edges,
          }))
        }
      }

      if (isAcceptedEventType(eventTypes, FlowEventType.FlowInitEnd)) {
        yield tracked(String(eventIndex++), newEvent(eventIndex, flowId, FlowEventType.FlowInitEnd, {
          flowId,
        }))
      }

      try {
        const iterator = createQueueIterator(eventQueue)
        for await (const event of iterator) {
          if (!isAcceptedEventType(eventTypes, event.type)) {
            continue
          }
          yield tracked(String(eventIndex++), event)
        }
      } finally {
        unsubscribe()
      }
    } finally {
      await eventQueue.close()
    }
  })
