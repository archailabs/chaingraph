/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type { INode, Position } from '@badaitech/chaingraph-types'
import type { Node } from '@xyflow/react'
import type {
  AddNodeEvent,
  NodeState,
  PasteNodesEvent,
  UpdateNodeParent,
  UpdateNodePosition,
  UpdateNodeTitleEvent,
  UpdateNodeUIEvent,
} from './types'
import { NODE_CATEGORIES } from '@badaitech/chaingraph-nodes'
import { DefaultPosition } from '@badaitech/chaingraph-types'

import { combine, sample } from 'effector'
import { $categoryMetadata } from '../categories'
import { globalReset } from '../common'
import { nodesDomain } from '../domains'
import { updatePort, updatePortUI, updatePortValue } from '../ports'
import { $trpcClient } from '../trpc/store'
import { LOCAL_NODE_UI_DEBOUNCE_MS, NODE_POSITION_DEBOUNCE_MS, NODE_UI_DEBOUNCE_MS } from './constants'
import { accumulateAndSample } from './operators/accumulate-and-sample'
import { positionInterpolator } from './position-interpolation-advanced'
import './interpolation-init'

// EVENTS

// Local state CRUD events
export const addNode = nodesDomain.createEvent<INode>()
export const addNodes = nodesDomain.createEvent<INode[]>()
export const updateNode = nodesDomain.createEvent<INode>()
export const removeNode = nodesDomain.createEvent<string>()
export const setNodeMetadata = nodesDomain.createEvent<{ nodeId: string, metadata: NodeState['metadata'] }>()
export const setNodeVersion = nodesDomain.createEvent<{ nodeId: string, version: number }>()
export const updateNodeParent = nodesDomain.createEvent<UpdateNodeParent>()

// Backend operation events
export const addNodeToFlow = nodesDomain.createEvent<AddNodeEvent>()
export const pasteNodesToFlow = nodesDomain.createEvent<PasteNodesEvent>()
export const removeNodeFromFlow = nodesDomain.createEvent<{ flowId: string, nodeId: string }>()

// Bulk operations
export const setNodes = nodesDomain.createEvent<Record<string, INode>>()
export const clearNodes = nodesDomain.createEvent()

// State events
export const setNodesLoading = nodesDomain.createEvent<boolean>()
export const setNodesError = nodesDomain.createEvent<Error | null>()

// UI update events
export const updateNodeUI = nodesDomain.createEvent<UpdateNodeUIEvent>()
export const updateNodeUILocal = nodesDomain.createEvent<UpdateNodeUIEvent>() // For optimistic updates
export const updateNodePosition = nodesDomain.createEvent<UpdateNodePosition>()
export const updateNodePositionLocal = nodesDomain.createEvent<UpdateNodePosition>() // For optimistic updates

export const updateNodeTitle = nodesDomain.createEvent<UpdateNodeTitleEvent>()

// New event for interpolated position updates
export const updateNodePositionInterpolated = nodesDomain.createEvent<{
  nodeId: string
  position: Position
}>()

// EFFECTS

// Backend node operations
export const addNodeToFlowFx = nodesDomain.createEffect(async (event: AddNodeEvent) => {
  const client = $trpcClient.getState()
  if (!client) {
    throw new Error('TRPC client is not initialized')
  }
  return client.flow.addNode.mutate({
    flowId: event.flowId,
    nodeType: event.nodeType,
    position: event.position,
    metadata: event.metadata,
  })
})

export const pasteNodesToFlowFx = nodesDomain.createEffect(async (event: PasteNodesEvent) => {
  const client = $trpcClient.getState()
  if (!client) {
    throw new Error('TRPC client is not initialized')
  }

  return client.flow.pasteNodes.mutate({
    flowId: event.flowId,
    clipboardData: event.clipboardData,
    pastePosition: event.pastePosition,
    virtualOrigin: event.virtualOrigin,
  })
})

export const initInterpolatorFx = nodesDomain.createEffect(() => {
  // Initialize interpolator update handler
  positionInterpolator.onUpdate = (nodeId, position) => {
    updateNodePositionInterpolated({
      nodeId,
      position,
    })
  }

  positionInterpolator.start()
})

const clearInterpolatorFx = nodesDomain.createEffect(() => {
  positionInterpolator.dispose()
})

export const removeNodeFromFlowFx = nodesDomain.createEffect(async (params: {
  flowId: string
  nodeId: string
}) => {
  const client = $trpcClient.getState()
  if (!client) {
    throw new Error('TRPC client is not initialized')
  }
  return client.flow.removeNode.mutate(params)
})

export const updateNodeUIFx = nodesDomain.createEffect(async (params: UpdateNodeUIEvent): Promise<UpdateNodeUIEvent> => {
  const client = $trpcClient.getState()

  if (!client) {
    throw new Error('TRPC client is not initialized')
  }
  if (!params.ui) {
    throw new Error('UI metadata is required')
  }

  return client.flow.updateNodeUI.mutate({
    flowId: params.flowId,
    nodeId: params.nodeId,
    ui: params.ui,
    version: params.version,
  })
})

export const updateNodeTitleFx = nodesDomain.createEffect(async (params: UpdateNodeTitleEvent): Promise<UpdateNodeTitleEvent> => {
  const client = $trpcClient.getState()

  if (!client) {
    throw new Error('TRPC client is not initialized')
  }
  if (!params.title) {
    throw new Error('Title is required')
  }

  return client.flow.updateNodeTitle.mutate({
    flowId: params.flowId,
    nodeId: params.nodeId,
    title: params.title,
    version: params.version,
  })
})

export const updateNodeParentFx = nodesDomain.createEffect(async (params: UpdateNodeParent): Promise<UpdateNodeParent> => {
  const client = $trpcClient.getState()

  if (!client) {
    throw new Error('TRPC client is not initialized')
  }
  return client.flow.updateNodeParent.mutate({
    flowId: params.flowId,
    nodeId: params.nodeId,
    parentNodeId: params.parentNodeId,
    position: params.position,
    version: params.version,
  })
})

export const baseUpdateNodePositionFx = nodesDomain.createEffect(async (params: UpdateNodePosition) => {
  const client = $trpcClient.getState()

  if (!client) {
    throw new Error('TRPC client is not initialized')
  }
  return client.flow.updateNodePosition.mutate({
    ...params,
    version: params.version,
  })
})

// Store for nodes
export const $nodes = nodesDomain.createStore<Record<string, INode>>({})
  .on(setNodes, (_, nodes) => ({ ...nodes }))

  // Single node operations - only clone the affected node and preserve others
  .on(addNode, (state, node) => {
    return { ...state, [node.id]: node.clone() }
  })

  // Add nodes operation
  .on(addNodes, (state, nodes) => {
    const newState = { ...state }
    nodes.forEach((node) => {
      newState[node.id] = node.clone()
    })

    return newState
  })

  .on(updateNode, (state, node) => {
    // Create a new state object, but only clone the node we're updating
    return { ...state, [node.id]: node.clone() }
  })

  .on(removeNode, (state, id) => {
    // Use object destructuring for clean removal without full state copy
    const { [id]: _, ...rest } = state
    return rest
  })

  // Reset handlers
  .reset(clearNodes)
  // .reset(clearActiveFlow)

  // Metadata update operations
  .on(setNodeMetadata, (state, { nodeId, metadata }) => {
    const node = state[nodeId]
    if (!node)
      return state

    // Clone only the node being modified
    const updatedNode = node.clone()
    updatedNode.setMetadata(metadata)

    // Return new state with just the updated node changed
    return { ...state, [nodeId]: updatedNode }
  })

  // Version update - important for change tracking
  .on(setNodeVersion, (state, { nodeId, version }) => {
    const node = state[nodeId]
    if (!node) {
      console.error(`Node ${nodeId} not found in store`)
      return state
    }

    // Only clone the node we're updating
    const updatedNode = node.clone()
    updatedNode.setVersion(version)

    // Return new state with just the updated node changed
    return { ...state, [nodeId]: updatedNode }
  })

  // Port operations
  .on(updatePort, (state, { id, data, nodeVersion }) => {
    if (!data || !data.config)
      return state

    const nodeId = data.config?.nodeId
    if (!nodeId)
      return state

    const node = state[nodeId]
    if (!node)
      return state

    const port = node.getPort(id)
    if (!port)
      return state

    try {
      // Clone both node and port to maintain immutability
      const updatedNode = node.clone()
      const updatedPort = port.clone()

      updatedPort.setConfig(data.config)
      updatedPort.setValue(data.value)

      updatedNode.setPort(updatedPort)
      updatedNode.setVersion(nodeVersion)

      return { ...state, [nodeId]: updatedNode }
    } catch (e: any) {
      console.error('Error updating port value:', e, data)
      return state
    }
  })

  .on(updatePortValue, (state, { nodeId, portId, value }) => {
    const node = state[nodeId]
    if (!node)
      return state

    const port = node.getPort(portId)
    if (!port)
      return state

    try {
      // Clone both node and port
      const updatedNode = node.clone()
      const updatedPort = port.clone()

      updatedPort.setValue(value)
      updatedNode.setPort(updatedPort)

      return { ...state, [nodeId]: updatedNode }
    } catch (e: any) {
      console.error('Error updating port value:', e)
      return state
    }
  })

  .on(updatePortUI, (state, { nodeId, portId, ui }) => {
    const node = state[nodeId]
    if (!node)
      return state

    const port = node.getPort(portId)
    if (!port)
      return state

    // Clone both node and port
    const updatedNode = node.clone()
    const updatedPort = port.clone()

    updatedPort.setConfig({
      ...updatedPort.getConfig(),
      ui: {
        ...updatedPort.getConfig().ui,
        ...ui,
      },
    })

    updatedNode.setPorts(updatedNode.ports) // Keep existing ports
    updatedNode.setPort(updatedPort) // Update the specific port

    return { ...state, [nodeId]: updatedNode }
  })
  .reset(globalReset)

/**
 * Enhanced store for XYFlow nodes that preserves node references when only positions change.
 * This significantly reduces unnecessary re-renders.
 */
export const $xyflowNodes = combine(
  $nodes,
  $categoryMetadata,
  // $nodePositions,
  // (nodes, categoryMetadata, nodePositions) => {
  (nodes, categoryMetadata) => {
    if (!nodes || Object.keys(nodes).length === 0) {
      return []
    }

    // Create a cache for already created XYFlow nodes to preserve references
    const nodeCache = new Map<string, Node>()

    // Calculate z-index based on node depth and type
    const calculateZIndex = (node: INode, allNodes: Record<string, INode>): number => {
      let depth = 0
      let currentNode = node

      // Calculate depth by traversing up the parent chain
      while (currentNode.metadata.parentNodeId) {
        const parentNode = allNodes[currentNode.metadata.parentNodeId]
        if (!parentNode)
          break
        depth++
        currentNode = parentNode

        // Safety check to prevent infinite loops
        if (depth > 10)
          break
      }

      // Z-index calculation:
      // - Root groups: 0
      // - Child groups: parent z-index + 1
      // - Regular nodes: group z-index + 10 (to appear above groups)
      // - Schema captured nodes: group z-index + 20 (to appear above regular nodes)

      if (node.metadata.category === 'group') {
        return depth * 10 // Groups at different depths
      } else {
        // Regular nodes should be above their parent group
        const parentNode = node.metadata.parentNodeId ? allNodes[node.metadata.parentNodeId] : undefined
        const parentZIndex = parentNode ? calculateZIndex(parentNode, allNodes) : 0

        // Check if this is a schema captured node (has isMovingDisabled)
        const isSchemaNode = node.metadata.ui?.state?.isMovingDisabled === true

        return parentZIndex + (isSchemaNode ? 20 : 10)
      }
    }

    // Helper function to get category metadata within this computation
    const getCategoryMetadata = (categoryId: string) =>
      categoryMetadata.get(categoryId) ?? categoryMetadata.get(NODE_CATEGORIES.OTHER)!

    // Sort nodes to have groups first, then regular nodes
    const sortedNodes = Object.values(nodes).sort((a, b) => {
      if (a.metadata.category === NODE_CATEGORIES.GROUP)
        return -1
      if (b.metadata.category === NODE_CATEGORIES.GROUP)
        return 1
      return 0
    })

    // Filter out hidden nodes and transform to XYFlow node format
    return sortedNodes
      .filter(node => node.metadata.ui?.state?.isHidden !== true)
      .map((node): Node => {
        const nodeId = node.id
        const nodeCategoryMetadata = getCategoryMetadata(node.metadata.category!)
        const nodeType = node.metadata.category === NODE_CATEGORIES.GROUP
          ? 'groupNode'
          : 'chaingraphNode'

        // Get position from the positions store if available
        // const position = nodePositions[nodeId] || node.metadata.ui?.position || DefaultPosition
        const position = node.metadata.ui?.position || DefaultPosition

        const parentNode = node.metadata.parentNodeId ? nodes[node.metadata.parentNodeId] : undefined

        // Round positions to integers for better rendering performance
        const nodePositionRound = {
          x: Math.round(position.x),
          y: Math.round(position.y),
        }

        // Get existing node from cache if it exists and hasn't changed
        // Include parent hierarchy in cache key since z-index depends on it
        const getParentChain = (n: INode): string => {
          const parents: string[] = []
          let current = n
          while (current.metadata.parentNodeId) {
            parents.push(current.metadata.parentNodeId)
            current = nodes[current.metadata.parentNodeId]
            if (!current)
              break
          }
          return parents.join('-')
        }

        const cacheKey = `${nodeId}-${node.getVersion()}-${getParentChain(node)}`
        const cachedNode = nodeCache.get(cacheKey)

        // Check if we can reuse the cached node (only position might have changed)
        const currentZIndex = calculateZIndex(node, nodes)
        if (cachedNode
          && (cachedNode.data.node as INode).getVersion() === node.getVersion()
          && cachedNode.parentId === node.metadata.parentNodeId
          && cachedNode.selected === (node.metadata.ui?.state?.isSelected ?? false)
          && cachedNode.zIndex === currentZIndex) {
          // If only the position changed, just update that and return the same node reference
          if (cachedNode.position.x !== nodePositionRound.x
            || cachedNode.position.y !== nodePositionRound.y) {
            cachedNode.position = nodePositionRound
          }

          return cachedNode
        }

        // Create a new node
        const reactflowNode: Node = {
          id: nodeId,
          type: nodeType,
          position: nodePositionRound,
          width: node.metadata.ui?.dimensions?.width ?? 200, // Default width if not set
          height: node.metadata.ui?.dimensions?.height ?? 50, // Default height if not set
          initialWidth: node.metadata.ui?.dimensions?.width ?? 200, // Initial width for resizing
          initialHeight: node.metadata.ui?.dimensions?.height ?? 50, // Initial height for resizing
          zIndex: calculateZIndex(node, nodes),
          data: {
            node,
            categoryMetadata: nodeCategoryMetadata,
          },
          parentId: node.metadata.parentNodeId,
          extent: parentNode && parentNode.metadata.category !== 'group' ? 'parent' : undefined, // Use parent extent if it has a parent and is not a group
          selected: node.metadata.ui?.state?.isSelected ?? false,
          hidden: node.metadata.ui?.state?.isHidden ?? false,
          selectable: node.metadata.category === 'group'
            ? true // All groups should be selectable
            : !(parentNode && parentNode.metadata.category !== 'group'), // Regular nodes follow existing logic
        }

        // Set dimensions if available and valid
        const MIN_NODE_WIDTH = 100
        const MIN_NODE_HEIGHT = 40

        if (
          node.metadata.ui?.dimensions
          && node.metadata.ui.dimensions.width > MIN_NODE_WIDTH
          && node.metadata.ui.dimensions.height > MIN_NODE_HEIGHT
        ) {
          reactflowNode.width = node.metadata.ui.dimensions.width
          reactflowNode.height = node.metadata.ui.dimensions.height
        }

        // Store in cache for future reference
        nodeCache.set(cacheKey, reactflowNode)

        return reactflowNode
      })
  },
)

// Update nodes store to handle UI updates
$nodes
  .on(updateNodeUILocal, (state, { nodeId, ui }) => {
    const node = state[nodeId]
    if (!node || !ui)
      return state

    // Clone the node for the UI update
    const updatedNode = node.clone()
    updatedNode.setUI({
      ...updatedNode.metadata.ui ?? {},
      ...ui ?? {},
      style: {
        ...(updatedNode.metadata.ui?.style ?? {}),
        ...(ui.style ?? {}),
      },
      state: {
        ...(updatedNode.metadata.ui?.state ?? {}),
        ...(ui.state ?? {}),
      },
    }, false)

    return { ...state, [nodeId]: updatedNode }
  })

  .on(updateNodePositionLocal, (state, { flowId, nodeId, position }) => {
    // Don't modify state if node doesn't exist
    const node = state[nodeId]
    if (!node)
      return state

    // Skip update if position is unchanged
    if (
      node.metadata.ui?.position?.x === position.x
      && node.metadata.ui?.position?.y === position.y
    ) {
      return state
    }

    // Clone the node and update its position
    const updatedNode = node// .clone()
    // const updatedNode = node
    updatedNode.setPosition(position, false)

    // Fix: Use updatedNode instead of node
    return { ...state, [nodeId]: updatedNode }
  })

// Update store to handle interpolated positions
$nodes
  .on(updateNodePositionInterpolated, (state, { nodeId, position }) => {
    const node = state[nodeId]
    if (!node)
      return state

    // Clone the node and update its position
    const updatedNode = node.clone()
    updatedNode.setPosition(position, false)

    return { ...state, [nodeId]: updatedNode }
  })

// Update node parent
$nodes
  .on(updateNodeParent, (state, { nodeId, parentNodeId }) => {
    const node = state[nodeId]
    if (!node)
      return state

    // Clone the node and update its parent
    const updatedNode = node.clone()
    updatedNode.setMetadata({
      ...updatedNode.metadata,
      parentNodeId,
      ui: {
        ...updatedNode.metadata.ui,
      },
    })

    return { ...state, [nodeId]: updatedNode }
  })

// Loading states
export const $isNodesLoading = nodesDomain.createStore(false)
  .on(setNodesLoading, (_, isLoading) => isLoading)
  .on(addNodeToFlowFx.pending, (_, isPending) => isPending)
  .on(removeNodeFromFlowFx.pending, (_, isPending) => isPending)
  .reset(globalReset)

// Error states
export const $addNodeError = nodesDomain.createStore<Error | null>(null)
  .on(addNodeToFlowFx.failData, (_, error) => error)
  .reset(addNodeToFlowFx.done)
  .reset(globalReset)

export const $removeNodeError = nodesDomain.createStore<Error | null>(null)
  .on(removeNodeFromFlowFx.failData, (_, error) => error)
  .reset(removeNodeFromFlowFx.done)
  .reset(globalReset)

// Combined error store
export const $nodesError = combine(
  $addNodeError,
  $removeNodeError,
  (addError, removeError) => addError || removeError,
)

// SAMPLES

// * * * * * * * * * * * * * * *
// CRUD operations
// * * * * * * * * * * * * * * *
// Handle backend node operations
sample({
  clock: addNodeToFlow,
  target: addNodeToFlowFx,
})

sample({
  clock: pasteNodesToFlow,
  target: pasteNodesToFlowFx,
})

sample({
  clock: removeNodeFromFlow,
  target: removeNodeFromFlowFx,
})

// * * * * * * * * * * * * * * *
// Position operations
// * * * * * * * * * * * * * * *

// Update local position immediately with small debounce
const throttledUpdateNodePositionLocal = accumulateAndSample({
  source: [updateNodePosition],
  timeout: LOCAL_NODE_UI_DEBOUNCE_MS,
  getKey: update => update.nodeId,
})

sample({
  clock: throttledUpdateNodePositionLocal,
  // clock: updateNodePosition,
  target: [updateNodePositionLocal],
})

// throttled node position updates
const throttledUpdatePosition = accumulateAndSample({
  source: [updateNodePosition],
  timeout: NODE_POSITION_DEBOUNCE_MS,
  getKey: update => update.nodeId,
})

// Update local node version and send the updated position to the server
sample({
  clock: throttledUpdatePosition,
  source: $nodes,
  fn: (nodes, params) => ({
    ...params,
    version: (nodes[params.nodeId]?.getVersion() ?? 0) + 1,
  }),
  target: [setNodeVersion, baseUpdateNodePositionFx],
})

// * * * * * * * * * * * * * * *
// Node operations
// * * * * * * * * * * * * * * *

// On node parent update, update the local node version and send the updated parent to the server
sample({
  clock: updateNodeParent,
  source: $nodes,
  fn: (nodes, params) => ({
    ...params,
    version: (nodes[params.nodeId].getVersion() ?? 0) + 1,
  }),
  target: [setNodeVersion, updateNodeParentFx],
})

// * * * * * * * * * * * * * * *
// Node UI operations
// * * * * * * * * * * * * * * *

sample({
  clock: updateNodeTitle,
  source: $nodes,
  // set actual node version before sending to the server
  fn: (nodes, params) => ({
    ...params,
    version: (nodes[params.nodeId].getVersion() ?? 0) + 1,
  }),
  target: [updateNodeTitleFx],
})

// Handle optimistic updates
const throttledUpdateNodeUILocal = accumulateAndSample({
  source: [updateNodeUI],
  timeout: LOCAL_NODE_UI_DEBOUNCE_MS,
  getKey: update => update.nodeId,
})

sample({
  clock: throttledUpdateNodeUILocal,
  target: [updateNodeUILocal],
})

const throttledUIUpdate = accumulateAndSample({
  source: [updateNodeUI],
  timeout: NODE_UI_DEBOUNCE_MS,
  getKey: update => update.nodeId,
})

// Create middleware to update the version of the node before sending it to the server
sample({
  clock: throttledUIUpdate,
  source: $nodes,
  fn: (nodes, params) => {
    return {
      ...params,
      version: (nodes[params.nodeId].getVersion() ?? 0) + 1,
    }
  },
  target: [setNodeVersion, updateNodeUIFx],
})

sample({
  clock: clearNodes,
  target: clearInterpolatorFx,
})

// Create store for dragging nodes (nodes which user moves right now)
export const $draggingNodes = nodesDomain.createStore<string[]>([])
  // Track nodes that start being dragged
  .on(throttledUpdateNodeUILocal, (state, { nodeId, ui }) => {
    if (ui?.state?.isSelected) {
      // check if node id exists in the state:
      if (!state.includes(nodeId)) {
        // Add nodeId to the array if it's not already there
        return [...state, nodeId]
      }
    } else {
      // check if not selected and in the list, then remove from the list
      if (state.includes(nodeId)) {
        return state.filter(id => id !== nodeId)
      }
    }
    return state
  })
  .reset(globalReset)
