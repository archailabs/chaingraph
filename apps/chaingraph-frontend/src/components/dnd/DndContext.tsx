/*
 * Copyright (c) 2025 BadLabs
 *
 * Use of this software is governed by the Business Source License 1.1 included in the file LICENSE.txt.
 *
 * As of the Change Date specified in that file, in accordance with the Business Source License, use of this software will be governed by the Apache License, version 2.0.
 */

import type {
  CategoryMetadata,
  IPortConfig,
  NodeMetadataWithPorts,
} from '@badaitech/chaingraph-types'
import { createContext } from 'react'

export interface NodeDropEvent {
  node: NodeMetadataWithPorts
  categoryMetadata: CategoryMetadata
  position: { x: number, y: number }
  portsConfig: Map<string, IPortConfig>
}

export interface DndContextType {
  draggedNode: {
    node: NodeMetadataWithPorts
    categoryMetadata: CategoryMetadata
  } | null
  setDraggedNode: (data: { node: NodeMetadataWithPorts, categoryMetadata: CategoryMetadata, portsConfig?: Map<string, IPortConfig> } | null) => void
  onNodeDrop: (callback: (event: NodeDropEvent) => void) => () => void
  emitNodeDrop: (event: NodeDropEvent) => void
}

export const DndContext = createContext<DndContextType | undefined>(undefined)
